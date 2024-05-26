export const APPLICATION_STATUSES = [
  'APPLY',
  'DROP',
  'PASS',
  'INTERVIEW1',
  'INTERVIEW2',
  'FINAL_PASS',
];

// UserInfo의 중복 객체를 평탄화하는 함수
export const flattenUserInfo = function (obj) {
  const { UserInfo, ...rest } = obj;
  return { name: UserInfo.name, ...rest };
};
