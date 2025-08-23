

// ClassType
export type CharacterClassType =  "None" | "Knight" | "Archer" | "Mage" | "Cleric" | "Max"| string;
export enum CharacterClassTypeEnum  {
  None  = 0,
  Knight = 1,
  Cleric = 2,
  Archer = 3,
  Mage = 4,
  Max = 5
}

export const CharacterClassNameMap: Record<CharacterClassTypeEnum, CharacterClassType> = {
  [CharacterClassTypeEnum.None]:   "None",
  [CharacterClassTypeEnum.Knight]: "Knight",
  [CharacterClassTypeEnum.Cleric]: "Cleric",
  [CharacterClassTypeEnum.Archer]: "Archer",
  [CharacterClassTypeEnum.Mage]:   "Mage",
  [CharacterClassTypeEnum.Max]:    "Max",
};

// 역매핑: 문자열 → 숫자
export const CharacterClassValueMap: Record<CharacterClassType, CharacterClassTypeEnum> = {
  None : CharacterClassTypeEnum.None,
  Knight: CharacterClassTypeEnum.Knight,
  Cleric: CharacterClassTypeEnum.Cleric,
  Archer: CharacterClassTypeEnum.Archer,
  Mage:   CharacterClassTypeEnum.Mage,
  MAX:    CharacterClassTypeEnum.Max
};

// 헬퍼 함수 예시
export function classEnumToString(value: CharacterClassTypeEnum): CharacterClassType {
  return CharacterClassNameMap[value];
}

export function classStringToEnum(value: CharacterClassType): CharacterClassTypeEnum {
  return CharacterClassValueMap[value];
}