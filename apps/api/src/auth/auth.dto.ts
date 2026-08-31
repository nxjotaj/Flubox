import { IsBoolean, IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
export class RefreshDto { @IsString() @IsNotEmpty() refreshToken!: string; }
export class ForgotDto { @IsEmail() email!: string; }
export class ResetDto { @IsString() token!: string; @IsString() @MinLength(10) password!: string; }
export class RegisterDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @IsNotEmpty() companyName!: string;
  @IsString() @IsNotEmpty() taxId!: string;
  @IsBoolean() acceptTerms!: boolean;
  @IsBoolean() acceptPrivacy!: boolean;
}
