import { z } from 'zod';
import {
  isValidCnpj,
  isValidCpf,
  onlyDigits,
} from '@/modules/identity/brazil-documents';

const address = z.object({
  postalCode: z.string().transform(onlyDigits).pipe(z.string().length(8)),
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(20),
  complement: z.string().trim().max(80).optional(),
  district: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().toUpperCase().length(2),
});
const phone = z.string().transform(onlyDigits).pipe(z.string().min(10).max(13));
const cpf = z
  .string()
  .refine(isValidCpf, 'Informe um CPF válido.')
  .transform(onlyDigits);

export const onboardingSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('supplier'),
    cnpj: z
      .string()
      .refine(isValidCnpj, 'Informe um CNPJ válido.')
      .transform(onlyDigits),
    legalName: z.string().trim().min(3).max(160),
    tradeName: z.string().trim().min(2).max(120),
    stateRegistration: z.string().trim().max(30).optional(),
    responsibleName: z.string().trim().min(3).max(120),
    responsibleCpf: cpf,
    responsibleEmail: z.email(),
    responsiblePhone: phone,
    address,
  }),
  z.object({
    type: z.literal('reseller'),
    fullName: z.string().trim().min(3).max(120),
    cpf,
    phone,
    address,
  }),
]);

export type OnboardingInput = z.infer<typeof onboardingSchema>;
