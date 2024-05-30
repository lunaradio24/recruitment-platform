import express from 'express';
import requireAccessToken from '../middlewares/require-access-token.middleware.js';
import requireRoles from '../middlewares/require-roles.middleware.js';
import { APPLICATION_STATUSES } from '../constants/resume.constant.js';
import { flatter } from '../utils/flatter.util.js';
import { prisma } from '../utils/prisma.util.js';
import { Prisma } from '@prisma/client';
import { CustomError } from '../utils/custom-error.util.js';
import { HTTP_STATUS } from '../constants/http-status.constant.js';

const router = express.Router();

/*****     이력서 생성 API     *****/
router.post('/resumes', requireAccessToken, requireRoles(['APPLICANT']), async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져오기
    const { userId } = req.user;
    const { title, personalStatement } = req.body;

    // 2. 유효성 검증 및 에러 처리
    if (!title) throw new CustomError(HTTP_STATUS.BAD_REQUEST, '제목을 입력해주세요.');
    if (!personalStatement) throw new CustomError(HTTP_STATUS.BAD_REQUEST, '자기소개를 입력해주세요');
    if (personalStatement.length < 150)
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, '자기소개는 150자 이상 작성해야 합니다.');

    // 3. DB에 이력서 데이터 생성
    const resume = await prisma.resumes.create({
      data: {
        userId: userId,
        title,
        personalStatement,
      },
    });

    // 4. 반환 정보
    return res.status(HTTP_STATUS.CREATED).json({
      message: '이력서가 성공적으로 등록되었습니다.',
      data: resume,
    });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     이력서 목록 조회 API     *****/
router.get('/resumes', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져오기
    const { userId, role } = req.user;
    const { sort, status } = req.query; // (예) `sort=desc&status=APPLY`

    // 2. DB에서 조건에 맞는 이력서 찾기
    const resumes = await prisma.resumes.findMany({
      where: {
        //  - 역할이 'APPLICANT' 인 경우 현재 로그인 한 사용자가 작성한 이력서 목록만 조회
        //  - 역할이 'RECRUITER' 인 경우 모든 사용자의 이력서 조회 가능
        userId: role !== 'RECRUITER' ? userId : undefined,
        //  - status 값이 없는 경우 모든 상태의 이력서를 조회
        applicationStatus: status ? status.toUpperCase() : undefined,
      },
      orderBy: {
        //  - sort 값이 없는 경우 최신순(DESC) 정렬
        createdAt: sort ? sort.toLowerCase() : 'desc',
      },
      select: {
        resumeId: true,
        userId: false,
        user: {
          select: {
            name: true,
          },
        },
        title: true,
        personalStatement: true,
        applicationStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 3. 유효성 검증 및 에러 처리 - 찾은 이력서가 없는 경우
    if (!resumes) return res.status(HTTP_STATUS.OK).json({ data: [] });

    // 4. 반환 정보
    const flattedResumes = resumes.map((resume) => flatter(resume));
    return res.status(HTTP_STATUS.OK).json({ data: flattedResumes });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     이력서 상세 조회 API     *****/
router.get('/resumes/:resumeId', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보 가져오기
    const { userId, role } = req.user;
    const { resumeId } = req.params;

    // 2. DB에서 조건에 맞는 이력서 찾기
    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        //   - 역할이 'APPLICANT' 인 경우 현재 로그인 한 사용자가 작성한 이력서만 조회
        //   - 역할이 'RECRUITER' 인 경우 이력서 작성 사용자와 일치하지 않아도 이력서를 조회 가능
        userId: role !== 'RECRUITER' ? userId : undefined,
      },
      select: {
        resumeId: true,
        userId: false,
        user: {
          select: {
            name: true,
          },
        },
        title: true,
        personalStatement: true,
        applicationStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 3. 유효성 검증 및 에러 처리
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    // 4. 반환 정보
    const flattedResume = flatter(resume);
    return res.status(HTTP_STATUS.OK).json({ data: flattedResume });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     이력서 수정 API     *****/
router.patch('/resumes/:resumeId', requireAccessToken, requireRoles(['APPLICANT']), async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보 가져오기
    const { userId } = req.user;
    const { resumeId } = req.params;
    const { title, personalStatement } = req.body;

    // 2. 유효성 검증 및 에러 처리
    if (!title && !personalStatement) throw new CustomError(HTTP_STATUS.BAD_REQUEST, '수정할 정보를 입력해 주세요.');

    // 3. DB에서 현재 로그인 한 사용자의 이력서 찾기 (resumeId is given)
    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });

    // 4. 유효성 검증 및 에러 처리
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    // 5. DB에서 해당 이력서 데이터 수정
    const updatedResume = await prisma.resumes.update({
      where: {
        resumeId: +resumeId,
        userId: userId, // 없어도 되지만 만약을 대비
      },
      data: {
        title: title, // undefined 이면 기존 값 유지
        personalStatement: personalStatement, //undefined 이면 기존 값 유지
      },
    });

    // 6. 반환 정보
    return res.status(HTTP_STATUS.OK).json({
      message: '이력서를 성공적으로 수정했습니다.',
      data: updatedResume,
    });

    // 7. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     이력서 삭제 API     *****/
router.delete('/resumes/:resumeId', requireAccessToken, requireRoles(['APPLICANT']), async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져오기
    const { userId } = req.user;
    const { resumeId } = req.params;

    // 2. DB에서 현재 로그인 한 사용자의 이력서 찾기 (resumeId is given)
    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });

    // 3. 유효성 검증 및 에러 처리
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    // 4. DB에서 해당 이력서 데이터 삭제
    await prisma.resumes.delete({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });

    // 5. 반환 정보
    return res.status(HTTP_STATUS.OK).json({
      message: '이력서를 성공적으로 삭제했습니다.',
      data: {
        resumeId: +resumeId,
      },
    });

    // 6. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     이력서 지원 상태 변경 API     *****/
router.patch('/resumes/:resumeId/status', requireAccessToken, requireRoles(['RECRUITER']), async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져오기
    const { userId: recruiterId } = req.user;
    const { resumeId } = req.params;
    const { applicationStatus: newStatus, reason } = req.body;

    // 2. 유효성 검증 및 에러 처리
    if (!newStatus) throw new CustomError(HTTP_STATUS.BAD_REQUEST, '변경하고자 하는 지원 상태를 입력해주세요.');
    if (!reason) throw new CustomError(HTTP_STATUS.BAD_REQUEST, '지원 상태 변경 사유를 입력해주세요.');
    if (!APPLICATION_STATUSES.includes(newStatus))
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, '유효하지 않은 지원 상태입니다.');

    // DB에서 이력서 찾기 (resumeId is given)
    const resume = await prisma.resumes.findUnique({
      where: { resumeId: +resumeId },
    });

    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');
    if (newStatus === resume.applicationStatus)
      throw new CustomError(HTTP_STATUS.BAD_REQUEST, '변경할 지원 상태가 이전 상태와 동일합니다.');

    // 3. DB에서 이력서 지원 상태 수정 & 이력서 로그 생성 (transaction으로 묶어서 실행)
    const resumeLog = await prisma.$transaction(
      async (txn) => {
        // Resumes 테이블에서 변경할 데이터 업데이트
        await txn.resumes.update({
          where: { resumeId: +resumeId },
          data: {
            applicationStatus: newStatus,
          },
        });
        // ResumeLogs 테이블에 변경 히스토리 삽입
        return await txn.resumeLogs.create({
          data: {
            resumeId: +resumeId,
            recruiterId: recruiterId,
            prevStatus: resume.applicationStatus,
            currStatus: newStatus,
            reason: reason,
          },
        });
      },
      {
        //격리 수준 설정
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    // 4. 반환 정보
    return res.status(HTTP_STATUS.CREATED).json({
      message: '이력서 상태 정보 변경에 성공했습니다.',
      data: resumeLog,
    });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     이력서 로그 목록 조회 API     *****/
router.get('/resumes/:resumeId/logs', requireAccessToken, requireRoles(['RECRUITER']), async (req, res, next) => {
  try {
    // 1. 요청 정보 가져오기
    const { resumeId } = req.params;

    // 2. DB에서 해당 이력서의 이력서 로그 찾기
    const resumeLogs = await prisma.resumeLogs.findMany({
      where: { resumeId: +resumeId },
      orderBy: { changedAt: 'desc' }, // - 생성일시 기준 최신순으로 조회합니다.
      select: {
        resumeLogId: true,
        resumeId: true,
        user: {
          select: {
            name: true,
          },
        },
        prevStatus: true,
        currStatus: true,
        reason: true,
        changedAt: true,
      },
    });

    // 3. 유효성 검증 및 에러 처리
    if (!resumeLogs) return res.status(HTTP_STATUS.OK).json({ data: [] });

    // 4. 반환 정보
    const flattedResumeLogs = resumeLogs.map((log) => flatter(log)); // 평탄화
    return res.status(HTTP_STATUS.OK).json({ data: flattedResumeLogs });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

export default router;
