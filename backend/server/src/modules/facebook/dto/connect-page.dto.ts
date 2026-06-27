import { IsString, MinLength } from 'class-validator';

export class ConnectPageDto {
  @IsString()
  @MinLength(1)
  fbPageId: string;
}
