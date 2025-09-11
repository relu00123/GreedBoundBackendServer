export class PortPool {
  private used = new Set<number>();
  constructor(private start: number, private end: number) {}

  /** 비어있는 포트를 하나 예약 */
  reserve(): number | null {
    for (let p = this.start; p <= this.end; p++) {
      if (!this.used.has(p)) { this.used.add(p); return p; }
    }
    return null;
  }
  /** 예약 해제 */
  release(p: number) { this.used.delete(p); }
}