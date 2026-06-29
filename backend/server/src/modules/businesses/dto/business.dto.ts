import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export const TONES = [
  'friendly',
  'professional',
  'playful',
  'luxurious',
  'minimal',
] as const;
export type Tone = (typeof TONES)[number];

export class CreateBusinessDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(100)
  industry: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  targetAudience?: string;

  @IsOptional()
  @IsIn(TONES as readonly string[])
  tone?: Tone;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? (parsed as string[]) : [value];
      } catch {
        return [value];
      }
    }
    return Array.isArray(value) ? (value as string[]) : [];
  })
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) industry?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) targetAudience?: string;
  @IsOptional() @IsIn(TONES as readonly string[]) tone?: Tone;
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string[] => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed) ? (parsed as string[]) : [value];
      } catch {
        return [value];
      }
    }
    return Array.isArray(value) ? (value as string[]) : [];
  })
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}
