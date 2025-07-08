import { IsNotEmpty, IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
} 