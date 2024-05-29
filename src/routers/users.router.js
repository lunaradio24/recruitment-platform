import express from 'express';
import requireAccessToken from '../middlewares/require-access-token.middleware.js';

const router = express.Router();

/*****     내 정보 조회 API     *****/
router.get('/users', requireAccessToken, async (req, res, next) => {
  try {
    // 1. 요청 정보로부터 사용자 정보 가져오기
    const { userId, email, name, role, createdAt, updatedAt } = req.user;

    // 2. 반환 정보
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

    // 3. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

export default router;
