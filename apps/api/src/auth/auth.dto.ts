import { IsBoolean, IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
export class LoginDto { @IsEmail() email!: string; @IsString() password!: string; }
export class RegisterDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(10) password!: string;
  @IsString() @IsNotEmpty() companyName!: string;
  @IsString() @IsNotEmpty() taxId!: string;
  @IsBoolean() acceptTerms!: boolean;
  @IsBoolean() acceptPrivacy!: boolean;
}
