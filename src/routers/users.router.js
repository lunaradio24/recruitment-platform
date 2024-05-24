import express from 'express';
import authorizeAccessToken from '../middlewares/require-access-token.middleware.js';
import { prisma } from '../utils/prisma.util.js';

const router = express.Router();

// ### 내 정보 조회 API **(AccessToken 인증 필요)**
router.get('/users/:userId', authorizeAccessToken, async (req, res, next) => {
  // 인증 된 사용자의 정보를 조회합니다.
  // 1. 요청 정보 - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
  const queryId = req.params.userId;
  const { userId, email, createdAt, updatedAt } = req.user;
  const { role } = await prisma.userInfos.findUnique({
    where: { UserId: userId },
  });
  if (userId !== +queryId) {
    return res
      .status(400)
      .json({ errorMessage: '해당 사용자 정보의 조회 권한이 없습니다.' });
  }

  // 2. 반환 정보 - 사용자 ID, 이메일, 이름, 역할, 생성일시, 수정일시를 반환합니다.
  return res.status(200).json({
    data: {
      userId,
      email,
      role,
      createdAt,
      updatedAt,
    },
  });
});

export default router;
