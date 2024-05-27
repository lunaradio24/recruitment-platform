import express from 'express';
import { prisma } from '../utils/prisma.util.js';
import requireRefreshToken from '../middlewares/require-refresh-token.middleware.js';
import bcrypt from 'bcrypt';
import {
  createAccessToken,
  createRefreshToken,
} from '../constants/auth.constant.js';

const router = express.Router();

/*****     회원가입 API     *****/
router.post('/auth/sign-up', async (req, res, next) => {
  // 1. 요청 정보 - 이메일, 비밀번호, 비밀번호 확인, 이름을 Request Body(`req.body`)로 전달 받습니다.
  const { email, password, passwordConfirm, name } = req.body;

  // 2. 유효성 검증 및 에러 처리
  // - 회원 정보 중 하나라도 빠진 경우 - “OOO을 입력해 주세요.”
  if (!email) {
    return res.status(400).json({ errorMessage: 'email을 입력해 주세요.' });
  }
  if (!password) {
    return res.status(400).json({ errorMessage: '비밀번호을 입력해 주세요.' });
  }
  if (!passwordConfirm) {
    return res
      .status(400)
      .json({ errorMessage: '비밀번호 확인을 입력해 주세요.' });
  }
  if (!name) {
    return res.status(400).json({ errorMessage: '이름을 입력해 주세요.' });
  }

  // - 이메일 형식에 맞지 않는 경우 - “이메일 형식이 올바르지 않습니다.”
  const email_regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
  if (!email_regex.test(email)) {
    return res
      .status(400)
      .json({ errorMessage: '이메일 형식이 올바르지 않습니다.' });
  }

  // - 이메일이 중복되는 경우 - “이미 가입 된 사용자입니다.”
  const isExistUser = await prisma.users.findUnique({
    where: { email: email },
  });
  if (isExistUser) {
    return res.status(400).json({ errorMessage: '이미 가입된 사용자입니다.' });
  }

  //     - 비밀번호가 6자리 미만인 경우 - “비밀번호는 6자리 이상이어야 합니다.”
  if (password.length < 6) {
    return res
      .status(400)
      .json({ errorMessage: '비밀번호는 6자리 이상이어야 합니다.' });
  }

  //     - 비밀번호와 비밀번호 확인이 일치하지 않는 경우 - “입력한 두 비밀번호가 일치하지 않습니다.”
  if (password !== passwordConfirm) {
    return res
      .status(400)
      .json({ errorMessage: '입력한 두 비밀번호가 일치하지 않습니다.' });
  }

  // 3. 비즈니스 로직(데이터 처리)
  //  - 사용자 ID, 역할, 생성일시, 수정일시는 자동 생성됩니다.
  //  - 역할의 종류는 다음과 같으며, 기본 값은 `APPLICANT` 입니다. (지원자 `APPLICANT`, 채용 담당자 `RECRUITER`)
  //  - 보안을 위해 비밀번호는 평문(Plain Text)으로 저장하지 않고 Hash 된 값을 저장합니다.
  // Hashing Password
  const saltRounds = 10; // salting을 몇 번 반복할 지
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await prisma.users.create({
    data: {
      email: email,
      password: hashedPassword,
    },
  });

  const userInfo = await prisma.userInfos.create({
    data: {
      UserId: user.userId,
      name: name,
    },
  });

  // 4. 반환 정보
  //   - 사용자 ID, 이메일, 이름, 역할, 생성일시, 수정일시를 반환합니다.
  return res.status(201).json({
    message: '회원가입에 성공했습니다.',
    data: {
      userId: user.userId,
      email: email,
      name: name,
      role: userInfo.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
});

/*****     로그인 API     *****/
router.post('/auth/sign-in', async (req, res, next) => {
  try {
    // 1. 요청 정보 - 이메일, 비밀번호를 Request Body(`req.body`)로 전달 받습니다.
    const { email, password } = req.body;

    // 2. 유효성 검증 및 에러 처리
    //  - 로그인 정보 중 하나라도 빠진 경우 - “OOO을 입력해 주세요.”
    if (!email) {
      return res.status(400).json({ errorMessage: 'email을 입력해 주세요.' });
    }
    if (!password) {
      return res
        .status(400)
        .json({ errorMessage: '비밀번호을 입력해 주세요.' });
    }
    //  - 이메일 형식에 맞지 않는 경우 - “이메일 형식이 올바르지 않습니다.”
    const email_regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
    if (!email_regex.test(email)) {
      return res
        .status(400)
        .json({ errorMessage: '이메일 형식이 올바르지 않습니다.' });
    }
    //  - 이메일로 조회되지 않거나 비밀번호가 일치하지 않는 경우 - “인증 정보가 유효하지 않습니다.”
    const user = await prisma.users.findUnique({
      where: { email: email },
    });
    if (!user) {
      return res
        .status(400)
        .json({ errorMessage: '인증 정보가 유효하지 않습니다.' });
    }
    const pwMatch = await bcrypt.compare(password, user.password);
    if (!pwMatch) {
      return res
        .status(400)
        .json({ errorMessage: '인증 정보가 유효하지 않습니다.' });
    }

    // 3. 비즈니스 로직(데이터 처리)
    //Access, Refresh Token 발급 - Payload에 `사용자 ID`를 포함하고, 유효기한이 `12시간`
    const accessToken = createAccessToken(user.userId);
    const refreshToken = createRefreshToken(user.userId);

    //DB의 refreshTokens 테이블에 Refresh Token이 이미 있으면 저장 X
    const existingToken = await prisma.refreshTokens.findFirst({
      where: { UserId: user.userId },
    });
    //없다면, 새로 발급한 Refresh Token을 DB에 저장
    if (!existingToken) {
      await prisma.refreshTokens.create({
        data: {
          tokenId: await bcrypt.hash(refreshToken, 10),
          UserId: user.userId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    }
    //있다면, 새로 발급한 Refresh Token으로 갱신
    else {
      await prisma.refreshTokens.update({
        where: { tokenId: existingToken.tokenId },
        data: {
          tokenId: await bcrypt.hash(refreshToken, 10),
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    }
    // 4. 반환 정보 - AccessToken, RefreshToken을 반환합니다.
    //클라이언트에게 쿠키(토큰)을 할당
    res.cookie('accessToken', `Bearer ${accessToken}`);
    res.cookie('refreshToken', `Bearer ${refreshToken}`);

    return res.status(201).json({ message: '성공적으로 로그인 했습니다.' });
  } catch (error) {
    next(error);
  }
});

/*****     토큰 재발급 API     *****/
router.patch('/auth/renew', requireRefreshToken, async (req, res, next) => {
  try {
    // AccessToken 만료 시 RefreshToken을 활용해 재발급합니다.
    // 1. 요청 정보
    //     - RefreshToken(JWT)을 Request Header의 Authorization 값(`req.headers.authorization`)으로 전달 받습니다.
    const { refreshToken: oldToken } = req.cookies;
    const oldRefreshToken = oldToken.split(' ')[1];
    //     - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
    const { userId } = req.user;

    // 2. 비즈니스 로직(데이터 처리)
    //     - DB에 저장된 RefreshToken과 사용자가 가지고 있는 RefreshToken이 일치하는지 확인합니다.
    const { savedRefreshToken } = await prisma.refreshTokens.findUnique({
      where: { UserId: userId },
    });
    const isMatched = await bcrypt.compare(oldRefreshToken, savedRefreshToken);
    if (!isMatched)
      throw new Error('인증 정보가 일치하지 않습니다. 다시 로그인 해주세요.');
    //     - AccessToken(Payload에 `사용자 ID`를 포함하고, 유효기한이 `12시간`)을 생성합니다.
    const newAccessToken = createAccessToken(userId);
    //     - RefreshToken (Payload: 사용자 ID 포함, 유효기한: `7일`)을 생성합니다.
    const newRefreshToken = createRefreshToken(userId);
    //     - DB에 저장된 RefreshToken을 갱신합니다.
    await prisma.refreshTokens.update({
      where: {
        tokenId: await bcrypt.hash(oldRefreshToken, 10),
        UserId: userId,
      },
      data: {
        tokenId: await bcrypt.hash(newRefreshToken, 10),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    // 3. 반환 정보
    //     - AccessToken, RefreshToken을 반환합니다.
    res.cookie('accessToken', `Bearer ${newAccessToken}`);
    res.cookie('refreshToken', `Bearer ${newRefreshToken}`);
  } catch (error) {
    next(error);
  }
});

/*****     로그아웃 API     *****/
router.delete('/auth/sign-out', requireRefreshToken, async (req, res, next) => {
  try {
    // 요청한 RefreshToken으로 더 이상 토큰 재발급 API를 호출할 수 없도록 합니다.
    // 1. 요청 정보
    //     - RefreshToken(JWT)을 Request Header의 Authorization 값(`req.headers.authorization`)으로 전달 받습니다.
    const { refreshToken } = req.cookies;
    const token = refreshToken.split(' ')[1];

    //     - 사용자 정보는 인증 Middleware(`req.user`)를 통해서 전달 받습니다.
    const { userId } = req.user;

    // 2. 비즈니스 로직(데이터 처리)
    //     - DB에서 RefreshToken을 삭제합니다.
    await prisma.refreshTokens.delete({
      where: {
        tokenId: await bcrypt.hash(token, 10),
        UserId: userId,
      },
    });

    // 3. 반환 정보
    //     - 사용자 ID를 반환합니다.
    return res.status(200).json({
      message: '성공적으로 로그아웃 했습니다.',
      data: {
        userId: userId,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
