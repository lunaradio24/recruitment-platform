import dotenv from 'dotenv';
import express from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from './utils/prisma.util.js';

const app = express();
const PORT = 3020;

app.use(express.json());

// app.use('/', []);

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});
