import express from 'express';
import bcrypt from 'bcrypt';
import requireRefreshToken from '../middlewares/require-refresh-token.middleware.js';
import { prisma } from '../utils/prisma.util.js';
import { Prisma } from '@prisma/client';
import { EMAIL_REGEX, SALT_ROUNDS } from '../constants/auth.constant.js';
import { createAccessToken, createRefreshToken } from '../utils/auth.util.js';
import { CustomError } from '../utils/custom-error.util.js';

const router = express.Router();

/*****     회원가입 API     *****/
router.post('/auth/sign-up', async (req, res, next) => {
  try {
    // 1. Request Body에서 요청 정보 가져오기
    const { email, password, passwordConfirm, name } = req.body;

    // 2. 유효성 검증 및 에러 처리
    // - 회원 정보 중 하나라도 빠진 경우
    if (!email) throw new CustomError(400, 'email을 입력해 주세요.');
    if (!password) throw new CustomError(400, '비밀번호을 입력해 주세요.');
    if (!passwordConfirm) throw new CustomError(400, '비밀번호 확인을 입력해 주세요.');
    if (!name) throw new CustomError(400, '이름을 입력해 주세요.');

    // - 이메일 형식에 맞지 않는 경우
    if (!EMAIL_REGEX.test(email)) throw new CustomError(400, '이메일 형식이 올바르지 않습니다.');

    //  - 비밀번호가 6자리 미만인 경우
    if (password.length < 6) throw new CustomError(400, '비밀번호는 6자리 이상이어야 합니다.');
    if (password !== passwordConfirm) throw new CustomError(400, '입력한 두 비밀번호가 일치하지 않습니다.');

    // - 이메일이 중복되는 경우
    const isExistUser = await prisma.auths.findUnique({ where: { email: email } });
    if (isExistUser) throw new CustomError(400, '이미 가입된 사용자입니다.');

    // 3. 비즈니스 로직(데이터 처리) - transaction으로 묶어서 처리
    const createdUserInfo = await prisma.$transaction(
      async (txn) => {
        //Auth 테이블에 데이터 생성
        const auth = await txn.auths.create({
          data: {
            email: email,
            password: await bcrypt.hash(password, SALT_ROUNDS), // Hashed Password
          },
        });
        //Users 테이블에 데이터 생성
        const user = await txn.users.create({
          data: {
            authId: auth.authId,
            name: name,
          },
        });
        return { auth, user };
      },
      {
        //격리 수준 설정
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    const { auth, user } = createdUserInfo;

    // 4. 반환 정보
    return res.status(201).json({
      message: '회원가입에 성공했습니다.',
      data: {
        authId: auth.authId,
        email: email,
        name: name,
        role: user.role,
        createdAt: auth.createdAt,
        updatedAt: auth.updatedAt,
      },
    });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     로그인 API     *****/
router.post('/auth/sign-in', async (req, res, next) => {
  try {
    // 1. Request Body에서 요청정보 가져오기
    const { email, password } = req.body;

    // 2. 유효성 검증 및 에러 처리
    //  - 로그인 정보 중 하나라도 빠진 경우
    if (!email) throw new CustomError(400, 'email을 입력해 주세요.');
    if (!password) throw new CustomError(400, '비밀번호을 입력해 주세요.');

    //  - 이메일 형식에 맞지 않는 경우
    if (!EMAIL_REGEX.test(email)) throw new CustomError(400, '이메일 형식이 올바르지 않습니다.');

    //  - 이메일로 조회되지 않거나 비밀번호가 일치하지 않는 경우
    const auth = await prisma.auths.findUnique({ where: { email: email } });
    const pwMatch = auth ? await bcrypt.compare(password, auth.password) : null;
    if (!auth || !pwMatch) throw new CustomError(400, '인증 정보가 유효하지 않습니다.');

    // 3. 토큰 발급
    // Access, Refresh Token 발급
    const accessToken = createAccessToken(auth.authId);
    const refreshToken = createRefreshToken(auth.authId);
    const saltedToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);

    // DB의 refreshTokens 테이블에 Refresh Token이 이미 있는지 확인
    const existingToken = await prisma.refreshTokens.findFirst({ where: { authId: auth.authId } });
    // 없다면, 새로 발급한 Refresh Token을 DB에 저장
    if (!existingToken) {
      await prisma.refreshTokens.create({
        data: {
          tokenId: saltedToken,
          authId: auth.authId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    }
    // 있다면, 새로 발급한 Refresh Token으로 갱신
    else {
      await prisma.refreshTokens.update({
        where: { authId: auth.authId },
        data: {
          tokenId: saltedToken,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    }
    // 4. 반환 정보 - AccessToken, RefreshToken을 반환
    return res.status(201).json({
      message: '성공적으로 로그인 했습니다.',
      accessToken: `Bearer ${accessToken}`,
      refreshToken: `Bearer ${refreshToken}`,
    });

    // 5. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     토큰 재발급 API     *****/
router.patch('/auth/renew', requireRefreshToken, async (req, res, next) => {
  try {
    // 1. 인증 Middleware를 통해서 사용자 정보 가져오기
    const { authId } = req.user;

    // 2. AccessToken, RefreshToken 재발급
    const newAccessToken = createAccessToken(authId);
    const newRefreshToken = createRefreshToken(authId);
    const saltedToken = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);

    // DB에 저장된 RefreshToken을 갱신
    await prisma.refreshTokens.update({
      where: { authId: authId },
      data: {
        tokenId: saltedToken,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // 3. 반환 정보 - AccessToken, RefreshToken을 반환
    return res.status(200).json({
      message: '성공적으로 토큰을 재발급 했습니다.',
      accessToken: `Bearer ${newAccessToken}`,
      refreshToken: `Bearer ${newRefreshToken}`,
    });

    // 4. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

/*****     로그아웃 API     *****/
router.post('/auth/sign-out', requireRefreshToken, async (req, res, next) => {
  try {
    // 1. 인증 Middleware를 통해서 사용자 정보 가져오기
    const { authId } = req.user;

    // 2. DB에서 RefreshToken을 삭제
    await prisma.refreshTokens.delete({ where: { authId: authId } });

    // 3. 반환 정보
    return res.status(200).json({
      message: '성공적으로 로그아웃 했습니다.',
      data: { authId: authId },
    });

    // 4. 발생한 에러는 catch로 받아서 미들웨어에서 처리
  } catch (error) {
    next(error);
  }
});

export default router;
