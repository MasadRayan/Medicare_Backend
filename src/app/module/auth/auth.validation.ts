import { z } from "zod";

const PatientRegistrationZodSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.email("Invalid email address"),
	password: z
		.string()
		.min(5, "Password must be at least 5 characters long")
		.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
		.regex(/[a-z]/, "Password must contain at least one lowercase letter")
		.regex(/[0-9]/, "Password must contain at least one number")
		.regex(
			/[^A-Za-z0-9]/,
			"Password must contain at least one special character",
		),
	patient: z
		.object({
			contactNumber: z.string().optional(),
		})
		.optional(),
});

const PatientLoginZodSchema = z.object({
	email: z.email("Invalid email address"),
	password: z.string().min(1, "Password is required"),
});

export const UserValidation = {
	PatientRegistrationZodSchema,
	PatientLoginZodSchema,
};
