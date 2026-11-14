declare module 'timecraftjs' {
  export const ASM_SPICE_FULL: number
  export const ASM_SPICE_LITE: number
  export class Spice {
    init(type?: number): Promise<Spice>
    loadKernel(buffer: ArrayBuffer | Uint8Array, key?: string | null): void
    erract(op: string, action?: string): string
    failed(): number
    getmsg(option: string): string
    reset(): void
    str2et(str: string): number
    et2utc(et: number, format: string, prec: number): string
    spkpos(
      targ: string,
      et: number,
      ref: string,
      abcorr: string,
      obs: string,
    ): { ptarg: number[]; lt: number }
  }
}
