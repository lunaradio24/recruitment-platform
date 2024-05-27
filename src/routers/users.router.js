import express from 'express';
import requireAccessToken from '../middlewares/require-access-token.middleware.js';
import { prisma } from '../utils/prisma.util.js';

const router = express.Router();

// ### 내 정보 조회 API **(AccessToken 인증 필요)**
router.get('/users', requireAccessToken, async (req, res, next) => {
  // 인증 된 사용자의 정보를 조회합니다.
  // 1. 요청 정보 - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
  const { userId, authId, name, role, createdAt, updatedAt } = req.user;
  const { email } = await prisma.auths.findUnique({ where: { authId: authId } });

  // 2. 반환 정보 - 사용자 ID, 이메일, 이름, 역할, 생성일시, 수정일시를 반환합니다.
  return res.status(200).json({
    data: {
      userId,
      email,
      name,
      role,
      createdAt,
      updatedAt,
    },
  });
});

export default router;
