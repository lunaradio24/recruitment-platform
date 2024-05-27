import express from 'express';
import requireAccessToken from '../middlewares/require-access-token.middleware.js';
import requireRoles from '../middlewares/require-roles.middleware.js';
import { APPLICATION_STATUSES } from '../constants/resume.constant.js';
import { flatter } from '../utils/flatter.util.js';
import { prisma } from '../utils/prisma.util.js';
import { Prisma } from '@prisma/client';
import { CustomError } from '../utils/custom-error.util.js';

const router = express.Router();

/*****     이력서 생성 API     *****/
router.post('/resumes', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져옵니다.
    const { userId } = req.user;
    const { title, personalStatement } = req.body;

    // 2. 유효성 검증 및 에러 처리
    //   - 제목, 자기소개 중 하나라도 빠진 경우
    if (!title) throw new CustomError(400, '제목을 입력해주세요.');
    if (!personalStatement) throw new CustomError(400, '자기소개를 입력해주세요');
    //   - 자기소개 글자 수가 150자 보다 짧은 경우
    if (personalStatement.length < 150) throw new CustomError(400, '자기소개는 150자 이상 작성해야 합니다.');

    // 3. 비즈니스 로직(데이터 처리)
    //   - 작성자 ID는 인증 Middleware에서 전달 받은 정보를 활용합니다.
    const resume = await prisma.resumes.create({
      data: {
        userId: userId,
        title,
        personalStatement,
      },
    });

    // 4. 반환 정보
    //     - 이력서 ID, 작성자 ID, 제목, 자기소개, 지원 상태, 생성일시, 수정일시를 반환합니다.
    return res.status(201).json({
      message: '이력서가 성공적으로 등록되었습니다.',
      data: {
        resumeId: resume.resumeId,
        userId,
        title,
        personalStatement,
        applicationStatus: resume.applicationStatus,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 목록 조회 API     *****/
router.get('/resumes', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져옵니다.
    const { userId, role } = req.user;
    const { sort, status } = req.query; // (예) `sort=desc&status=APPLY`

    // 2. 비즈니스 로직(데이터 처리)
    const resumes = await prisma.resumes.findMany({
      where: {
        //  - 역할이 `APPLICANT` 인 경우 현재 로그인 한 사용자가 작성한 이력서 목록만 조회합니다.
        //  - 역할이 `RECRUITER` 인 경우 모든 사용자의 이력서를 조회할 수 있습니다.
        userId: role === 'APPLICANT' ? userId : undefined,
        // - status 값이 없는 경우 모든 상태의 이력서를 조회합니다.
        applicationStatus: status ? status.toUpperCase() : undefined,
      },
      orderBy: {
        // - sort 값이 없는 경우 최신순(DESC) 정렬을 기본으로 합니다. 대소문자 구분 없이 동작해야 합니다.
        createdAt: sort ? sort.toLowerCase() : 'desc',
      },
      select: {
        resumeId: true,
        userId: false,
        //  - 작성자 ID가 아닌 작성자 이름을 반환하기 위해 스키마에 정의 한 Relation을 활용해 조회합니다.
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
    //  - 일치하는 값이 없는 경우
    if (!resumes) return res.status(200).json({ data: [] });

    // 4. 반환 정보
    //  - 이력서 ID, 작성자 이름, 제목, 자기소개, 지원 상태, 생성일시, 수정일시의 목록을 반환합니다.
    const flattedResumes = resumes.map((resume) => flatter(resume));
    return res.status(200).json({ data: flattedResumes });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 상세 조회 API     *****/
router.get('/resumes/:resumeId', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져옵니다.
    const { userId, role } = req.user;
    const { resumeId } = req.params;

    // 2. 비즈니스 로직(데이터 처리)
    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        //   - 역할이 `APPLICANT` 인 경우 현재 로그인 한 사용자가 작성한 이력서만 조회합니다.
        //   - 역할이 `RECRUITER` 인 경우 이력서 작성 사용자와 일치하지 않아도 이력서를 조회할 수 있습니다.
        userId: role === 'APPLICANT' ? userId : undefined,
      },
      select: {
        resumeId: true,
        userId: false,
        //  - 작성자 ID가 아닌 작성자 이름을 반환하기 위해 스키마에 정의 한 Relation을 활용해 조회합니다.
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
    //     - 현재 로그인 한 사용자가 아닌 다른 사용자가 작성한 이력서를 조회하려는 경우 또는 이력서 정보가 없는 경우
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    // 4. 반환 정보
    //     - 이력서 ID, 작성자 이름, 제목, 자기소개, 지원 상태, 생성일시, 수정일시를 반환합니다.
    const flattedResume = flatter(resume);
    return res.status(200).json({ data: flattedResume });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 수정 API     *****/
router.patch('/resumes/:resumeId', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져옵니다.
    const { userId } = req.user;
    const { resumeId } = req.params;
    const { title, personalStatement } = req.body;

    // 2. 유효성 검증 및 에러 처리
    //  - 제목, 자기소개 둘 다 없는 경우
    if (!title && !personalStatement) throw new CustomError(400, '수정할 정보를 입력해 주세요.');

    // 3. 비즈니스 로직(데이터 처리)
    //  - 현재 로그인 한 사용자가 작성한 이력서만 수정합니다.
    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });
    // 4. 유효성 검증 및 에러 처리
    //  - 이력서 정보가 없는 경우
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    // 5. 비즈니스 로직(데이터 처리)
    //  - DB에서 이력서 정보를 수정합니다.
    //  - 제목, 자기소개는 개별 수정이 가능합니다.
    if (title !== resume.title) {
      await prisma.resumes.update({
        where: {
          resumeId: +resumeId,
          userId: userId,
        },
        data: { title },
      });
    }
    if (personalStatement !== resume.personalStatement) {
      await prisma.resumes.update({
        where: {
          resumeId: +resumeId,
          userId: userId,
        },
        data: { personalStatement },
      });
    }

    // 6. 반환 정보 - 수정 된 이력서
    const updatedResume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });
    // 수정된 이력서의 이력서 ID, 작성자 ID, 제목, 자기소개, 지원 상태, 생성일시, 수정일시를 반환합니다.
    return res.status(200).json({
      message: '이력서를 성공적으로 수정했습니다.',
      data: updatedResume,
    });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 삭제 API     *****/
router.delete('/resumes/:resumeId', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져옵니다.
    const { userId } = req.user;
    const { resumeId } = req.params;

    // 2. 비즈니스 로직(데이터 처리)
    //  - 현재 로그인 한 사용자가 작성한 이력서만 삭제합니다.
    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });

    // 3. 유효성 검증 및 에러 처리 - 이력서 정보가 없는 경우
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    // 4. 비즈니스 로직(데이터 처리) - DB에서 이력서 정보를 삭제합니다.
    await prisma.resumes.delete({
      where: {
        resumeId: +resumeId,
        userId: userId,
      },
    });

    // 5. 반환 정보 - 삭제 된 이력서의 이력서 ID를 반환합니다.
    return res.status(200).json({
      message: '이력서를 성공적으로 삭제했습니다.',
      data: {
        resumeId: +resumeId,
      },
    });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 지원 상태 변경 API     *****/
router.patch('/resumes/:resumeId/status', requireAccessToken, requireRoles(['RECRUITER']), async (req, res, next) => {
  try {
    // 1. 사용자 정보와 요청 정보를 가져옵니다.
    const { userId: recruiterId } = req.user;
    const { resumeId } = req.params;
    const { applicationStatus: newStatus, reason } = req.body;

    // 2. 유효성 검증 및 에러 처리
    //   - 지원 상태가 없는 경우
    if (!newStatus) throw new CustomError(400, '변경하고자 하는 지원 상태를 입력해주세요.');

    //   - 사유가 없는 경우
    if (!reason) throw new CustomError(400, '지원 상태 변경 사유를 입력해주세요.');

    //   - 유효하지 않은 지원 상태를 입력 한 경우
    if (!APPLICATION_STATUSES.includes(newStatus)) throw new CustomError(400, '유효하지 않은 지원 상태입니다.');

    const resume = await prisma.resumes.findUnique({
      where: { resumeId: +resumeId },
    });
    //   - 이력서 정보가 없는 경우
    if (!resume) throw new CustomError(404, '이력서가 존재하지 않습니다.');

    //     - 변경할 값이 이전과 동일한 경우
    if (newStatus === resume.applicationStatus)
      throw new CustomError(400, '변경할 지원 상태가 이전 상태와 동일합니다.');

    // 3. 비즈니스 로직(데이터 처리)
    //     - 이력서 지원 상태 수정과 이력서 로그 생성을 Transaction으로 묶어서 실행합니다.
    await prisma.$transaction(
      async (txn) => {
        //Resumes 테이블에서 변경할 데이터 업데이트
        await txn.resumes.update({
          where: { resumeId: +resumeId },
          data: {
            applicationStatus: newStatus,
          },
        });
        //ResumeLogs 테이블에 변경 히스토리 삽입
        await txn.resumeLogs.create({
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
    //     - 생성 된 이력서 로그 정보(이력서 로그 ID, 채용 담당자 ID, 이력서 ID, 예전 상태, 새로운 상태, 사유, 생성일시)를 반환합니다.
    return res.status(201).json({
      message: '이력서 상태 정보 변경에 성공했습니다.',
      data: {
        resumeId: +resumeId,
        recruiterId: recruiterId,
        prevStatus: resume.applicationStatus,
        currStatus: newStatus,
        reason: reason,
      },
    });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 로그 목록 조회 API     *****/
router.get('/resumes/:resumeId/logs', requireAccessToken, requireRoles(['RECRUITER']), async (req, res, next) => {
  try {
    // 1. 요청 정보
    //    - 이력서 ID를 Path Parameters로 전달 받습니다.
    const { resumeId } = req.params;

    // 2. 비즈니스 로직(데이터 처리)
    const resumeLogs = await prisma.resumeLogs.findMany({
      where: { resumeId: +resumeId },
      orderBy: { changedAt: 'desc' }, // - 생성일시 기준 최신순으로 조회합니다.
      select: {
        resumeLogId: true,
        resumeId: true,
        // - 채용 담당자 ID가 아닌 채용 담당자 이름을 반환하기 위해 스키마에 정의한 Relation을 활용해 조회합니다.
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
    //    - 일치하는 값이 없는 경우
    if (!resumeLogs) return res.status(200).json({ data: [] });

    // 4. 반환 정보
    //    - 조회 한 이력서 로그 정보(이력서 로그 ID, 채용 담당자 이름, 이력서 ID, 예전 상태, 새로운 상태, 사유, 생성일시) 목록을 반환합니다.
    const flattedResumeLogs = resumeLogs.map((log) => flatter(log));
    return res.status(200).json({ data: flattedResumeLogs });
  } catch (error) {
    next(error);
  }
});

export default router;
