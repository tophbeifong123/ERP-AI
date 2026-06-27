import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const TONES = ['friendly', 'professional', 'playful', 'luxurious', 'minimal'] as const;
export type Tone = (typeof TONES)[number];

export const AUTO_POST_MODES = ['ai_decide', 'fixed_schedule'] as const;
export type AutoPostMode = (typeof AUTO_POST_MODES)[number];

export class FixedScheduleRuleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must be HH:mm' })
  time: string;
}

export class AutoPostConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsIn(AUTO_POST_MODES as readonly string[])
  mode: AutoPostMode;

  @IsInt()
  @Min(1)
  @Max(14)
  postsPerWeekTarget: number;

  @IsInt()
  @Min(0)
  @Max(7)
  minGapDays: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FixedScheduleRuleDto)
  fixedScheduleRules?: FixedScheduleRuleDto[];
}

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
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AutoPostConfigDto)
  autoPost?: AutoPostConfigDto;
}

export class UpdateBusinessDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) industry?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) targetAudience?: string;
  @IsOptional() @IsIn(TONES as readonly string[]) tone?: Tone;
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[];
}

export class UpdateAutoPostDto {
  @IsBoolean() enabled: boolean;
  @IsIn(AUTO_POST_MODES as readonly string[]) mode: AutoPostMode;
  @IsInt() @Min(1) @Max(14) postsPerWeekTarget: number;
  @IsInt() @Min(0) @Max(7) minGapDays: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => FixedScheduleRuleDto)
  fixedScheduleRules: FixedScheduleRuleDto[];
}
