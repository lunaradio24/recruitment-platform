// User의 중복 객체를 평탄화하는 함수
export const flatter = function (obj) {
  const { user, ...rest } = obj;
  return { name: user.name, ...rest };
};
