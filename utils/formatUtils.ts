
export const FormatUtils = {
    /**
     * 문자열을 고정 폭으로 맞추되,
     * 길이가 짧으면 오른쪽에 공백을 채우고,
     * 길이가 길면 잘라낸다.
     */
    fixedWidthString(str: string, width: number): string {
        if (str.length >= width) {
            return str.slice(0, width);
        }
        return str.padEnd(width, " ");
    },

    /**
     * 숫자를 고정 폭으로 맞춤 (왼쪽 공백 패딩)
     */
    fixedWidthNumber(num: number, width: number): string {
        const str = num.toString();
        if (str.length >= width) {
            return str.slice(0, width);
        }
        return str.padStart(width, " ");
    }
};