import express from 'express';
import requireAccessToken from '../middlewares/require-access-token.middleware.js';
import requireRoles from '../middlewares/require-roles.middleware.js';
import {
  APPLICATION_STATUSES,
  flattenUserInfo,
} from '../constants/resume.constant.js';
import { prisma } from '../utils/prisma.util.js';
import { Prisma } from '@prisma/client';

const router = express.Router();

/*****     이력서 생성 API     *****/
router.post('/resumes', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 요청 정보
    //     - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
    const user = req.user;
    //     - 제목, 자기소개를 Request Body(`req.body`)로 전달 받습니다.
    const { title, personalStatement } = req.body;
    // 2. 유효성 검증 및 에러 처리
    //     - 제목, 자기소개 중 하나라도 빠진 경우 - “OO을 입력해 주세요”
    if (!title) throw new Error('제목을 입력해주세요.');
    if (!personalStatement) throw new Error('자기소개를 입력해주세요');
    //     - 자기소개 글자 수가 150자 보다 짧은 경우 - “자기소개는 150자 이상 작성해야 합니다.”
    if (personalStatement.length < 150)
      throw new Error('자기소개는 150자 이상 작성해야 합니다.');

    // 3. 비즈니스 로직(데이터 처리)
    //     - 작성자 ID는 인증 Middleware에서 전달 받은 정보를 활용합니다.
    const { userId } = user;
    //     - 이력서 ID, 지원 상태, 생성일시, 수정일시는 자동 생성됩니다.
    //     - 지원 상태의 종류는 다음과 같으며, 기본 값은 `APPLY` 입니다.
    //         - 서류 지원 완료 `APPLY`
    //         - 서류 탈락 `DROP`
    //         - 서류 합격 `PASS`
    //         - 1차 면접 `INTERVIEW1`
    //         - 2차 면접 `INTERVIEW2`
    //         - 최종 합격 `FINAL_PASS`
    const resume = await prisma.resumes.create({
      data: {
        UserId: userId,
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
    // 1. 요청 정보
    // - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
    const { userId } = req.user;
    // - Query Parameters(`req.query`)으로 정렬 조건과 지원 상태 별 필터링 조건을 받습니다.
    // - 예) `sort=desc&status=APPLY`
    // - sort 값이 없는 경우 최신순(DESC) 정렬을 기본으로 합니다. 대소문자 구분 없이 동작해야 합니다.
    // - status 값이 없는 경우 모든 상태의 이력서를 조회합니다.
    const { sort, status } = req.query;

    // 2. 비즈니스 로직(데이터 처리)
    //  - 역할이 `APPLICANT` 인 경우 현재 로그인 한 사용자가 작성한 이력서 목록만 조회합니다.
    //  - 역할이 `RECRUITER` 인 경우 모든 사용자의 이력서를 조회할 수 있습니다.
    //  - 정렬 조건에 따라 다른 결과 값을 조회합니다.
    const { role } = await prisma.userInfos.findUnique({
      where: { UserId: userId },
    });
    const resumes = await prisma.resumes.findMany({
      where: {
        UserId: role === 'APPLICANT' ? userId : undefined,
        applicationStatus: status ? status.toLowerCase() : undefined,
      },
      orderBy: {
        createdAt: sort ? sort.toLowerCase() : 'desc',
      },
      select: {
        resumeId: true,
        UserId: false,
        //  - 작성자 ID가 아닌 작성자 이름을 반환하기 위해 스키마에 정의 한 Relation을 활용해 조회합니다.
        UserInfo: {
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
    //  - 일치하는 값이 없는 경우 - 빈 배열(`[]`)을 반환합니다. (StatusCode: 200)
    if (!resumes) {
      return res.status(200).json({ data: [] });
    }

    // 4. 반환 정보
    //  - 이력서 ID, 작성자 이름, 제목, 자기소개, 지원 상태, 생성일시, 수정일시의 목록을 반환합니다.
    const flattedResumes = resumes.map((resume) => flattenUserInfo(resume));

    return res.status(200).json({ data: flattedResumes });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 상세 조회 API     *****/
router.get('/resumes/:resumeId', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 요청 정보
    //     - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
    const { userId } = req.user;
    //     - 이력서 ID를 Path Parameters(`req.params`)로 전달 받습니다.
    const { resumeId } = req.params;

    // 2. 비즈니스 로직(데이터 처리)
    const { role } = await prisma.userInfos.findUnique({
      where: { UserId: userId },
    });

    const resume = await prisma.resumes.findUnique({
      where: {
        resumeId: +resumeId,
        //   - 역할이 `APPLICANT` 인 경우 현재 로그인 한 사용자가 작성한 이력서만 조회합니다.
        //   - 역할이 `RECRUITER` 인 경우 이력서 작성 사용자와 일치하지 않아도 이력서를 조회할 수 있습니다.
        UserId: role === 'APPLICANT' ? userId : undefined,
      },
      select: {
        resumeId: true,
        UserId: false,
        //  - 작성자 ID가 아닌 작성자 이름을 반환하기 위해 스키마에 정의 한 Relation을 활용해 조회합니다.
        UserInfo: {
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
    if (!resume) throw new Error('이력서가 존재하지 않습니다.');

    // 4. 반환 정보
    //     - 이력서 ID, 작성자 이름, 제목, 자기소개, 지원 상태, 생성일시, 수정일시를 반환합니다.
    const flattedResume = flattenUserInfo(resume);

    return res.status(200).json({ data: flattedResume });
  } catch (error) {
    next(error);
  }
});

/*****     이력서 수정 API     *****/
router.patch(
  '/resumes/:resumeId',
  requireAccessToken,
  async (req, res, next) => {
    try {
      // 1. 요청 정보
      //  - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
      const { userId } = req.user;
      //  - 이력서 ID를 Path Parameters(`req.params`)로 전달 받습니다.
      const { resumeId } = req.params;
      //  - 제목, 자기소개를 Request Body(`req.body`)로 전달 받습니다.
      const { title, personalStatement } = req.body;

      // 2. 유효성 검증 및 에러 처리
      //  - 제목, 자기소개 둘 다 없는 경우 - “수정 할 정보를 입력해 주세요.”
      if (!title && !personalStatement) {
        throw new Error('수정할 정보를 입력해 주세요.');
      }

      // 3. 비즈니스 로직(데이터 처리)
      //  - 현재 로그인 한 사용자가 작성한 이력서만 수정합니다.
      //  - DB에서 이력서 조회 시 이력서 ID, 작성자 ID가 모두 일치해야 합니다.
      const resume = await prisma.resumes.findUnique({
        where: {
          resumeId: +resumeId,
          UserId: userId,
        },
      });
      // 4. 유효성 검증 및 에러 처리
      //  - 이력서 정보가 없는 경우 - “이력서가 존재하지 않습니다.”
      if (!resume) throw new Error('이력서가 존재하지 않습니다.');

      // 5. 비즈니스 로직(데이터 처리)
      //  - DB에서 이력서 정보를 수정합니다.
      //  - 제목, 자기소개는 개별 수정이 가능합니다.
      if (title !== resume.title) {
        await prisma.resumes.update({
          where: {
            UserId: userId,
            resumeId: +resumeId,
          },
          data: { title },
        });
      }
      if (personalStatement !== resume.personalStatement) {
        await prisma.resumes.update({
          where: {
            UserId: userId,
            resumeId: +resumeId,
          },
          data: { personalStatement },
        });
      }

      // 6. 반환 정보 - 수정 된 이력서
      const updatedResume = await prisma.resumes.findUnique({
        where: {
          UserId: userId,
          resumeId: +resumeId,
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
  },
);

/*****     이력서 삭제 API     *****/
router.delete(
  '/resumes/:resumeId',
  requireAccessToken,
  async (req, res, next) => {
    try {
      // 1. 요청 정보
      //  - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
      const { userId } = req.user;
      //  - 이력서 ID를 Path Parameters(`req.params`)로 전달 받습니다.
      const { resumeId } = req.params;

      // 2. 비즈니스 로직(데이터 처리)
      //  - 현재 로그인 한 사용자가 작성한 이력서만 삭제합니다.
      //  - DB에서 이력서 조회 시 이력서 ID, 작성자 ID가 모두 일치해야 합니다.
      const resume = await prisma.resumes.findUnique({
        where: {
          resumeId: +resumeId,
          UserId: userId,
        },
      });

      // 3. 유효성 검증 및 에러 처리 - 이력서 정보가 없는 경우 - “이력서가 존재하지 않습니다.”
      if (!resume) throw new Error('이력서가 존재하지 않습니다.');

      // 4. 비즈니스 로직(데이터 처리) - DB에서 이력서 정보를 삭제합니다.
      await prisma.resumes.delete({
        where: {
          resumeId: +resumeId,
          UserId: userId,
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
  },
);

/*****     이력서 지원 상태 변경 API     *****/
router.patch(
  '/resume/:resumeId/status-change',
  requireAccessToken,
  requireRoles(['RECRUITER']),
  async (req, res, next) => {
    try {
      // 채용 담당자가 지원자의 이력서 지원 상태를 변경하고, 이때 이력서 로그를 함께 생성합니다.
      // 1. 요청 정보
      //     - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
      const { userId: recruiterId } = req.user;
      //     - 이력서 ID를 Path Parameters(`req.params`)로 전달 받습니다.
      const { resumeId } = req.params;
      //     - 지원 상태, 사유를 Request Body(`req.body`)로 전달 받습니다.
      const { applicationStatus: newStatus, reason } = req.body;

      // 2. 유효성 검증 및 에러 처리
      //     - 지원 상태가 없는 경우 - “변경하고자 하는 지원 상태를 입력해 주세요.”
      if (!newStatus) {
        throw new Error('변경하고자 하는 지원 상태를 입력해주세요.');
      }
      //     - 사유가 없는 경우 - “지원 상태 변경 사유를 입력해 주세요.”
      if (!reason) {
        throw new Error('지원 상태 변경 사유를 입력해주세요.');
      }
      //     - 유효하지 않은 지원 상태를 입력 한 경우 - “유효하지 않은 지원 상태입니다.”
      if (!APPLICATION_STATUSES.includes(newStatus)) {
        throw new Error('유효하지 않은 지원 상태입니다.');
      }
      //     - 이력서 정보가 없는 경우 - “이력서가 존재하지 않습니다.”
      const resume = await prisma.resumes.findUnique({
        where: { resumeId: +resumeId },
      });
      if (!resume) throw new Error('이력서가 존재하지 않습니다.');

      // 3. 비즈니스 로직(데이터 처리)
      //     - 이력서 지원 상태 수정과 이력서 로그 생성을 Transaction으로 묶어서 실행합니다.
      await prisma.$transaction(
        async (txn) => {
          //변경할 값이 이전과 동일한 경우
          if (newStatus === resume.applicationStatus) {
            throw new Error('변경할 지원 상태가 이전 상태와 동일합니다.');
          }

          //Resumes 테이블에서 변경할 데이터 업데이트
          await txn.resumes.update({
            where: { resumeId: +resumeId },
            data: {
              applicationStatus: newStatus,
            },
          });
          //ResumeHistories 테이블에 변경 히스토리 삽입
          await txn.resumeHistories.create({
            data: {
              ResumeId: resumeId,
              RecruiterId: recruiterId,
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
          ResumeId: resumeId,
          RecruiterId: recruiterId,
          prevStatus: resume.applicationStatus,
          currStatus: newStatus,
          reason: reason,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/*****     이력서 로그 목록 조회 API     *****/
router.get(
  '/resumes/:resumeId/log-histories',
  requireAccessToken,
  requireRoles(['RECRUITER']),
  async (req, res, next) => {
    try {
      // 1. 요청 정보
      //    - 이력서 ID를 Path Parameters(`req.params`)로 전달 받습니다.
      const { resumeId } = req.params;

      // 2. 비즈니스 로직(데이터 처리)
      //    - 생성일시 기준 최신순으로 조회합니다.
      //    - 채용 담당자 ID가 아닌 채용 담당자 이름을 반환하기 위해 스키마에 정의한 Relation을 활용해 조회합니다.
      const resumeHistories = await prisma.resumeHistories.findMany({
        where: { resumeId: +resumeId },
        orderBy: { changedAt: 'desc' },
        select: {
          resumeHistoryId: true,
          ResumeId: true,
          UserInfo: {
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
      //    - 일치하는 값이 없는 경우 - 빈 배열(`[]`)을 반환합니다. (StatusCode: 200)
      if (!resumeHistories) return res.status(200).json({ data: [] });

      // 4. 반환 정보
      //    - 조회 한 이력서 로그 정보(이력서 로그 ID, 채용 담당자 이름, 이력서 ID, 예전 상태, 새로운 상태, 사유, 생성일시) 목록을 반환합니다.
      const flattedResumeHistories = resumeHistories.map((resumeHistory) =>
        flattenUserInfo(resumeHistory),
      );

      return res.status(200).json({ data: flattedResumeHistories });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
