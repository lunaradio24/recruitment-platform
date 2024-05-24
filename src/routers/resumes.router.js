import express from 'express';
import authorizeAccessToken from '../middlewares/require-access-token.middleware.js';
import { prisma } from '../utils/prisma.util.js';
import { ApplicationStatus } from '@prisma/client';

const router = express.Router();

/*****     이력서 생성 API     *****/
router.post('/resumes', authorizeAccessToken, async (req, res, next) => {
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
    if (personalStatement.length < 15)
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

export default router;
