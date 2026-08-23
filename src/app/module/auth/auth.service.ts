/** biome-ignore-all lint/style/useConst: needed for mutable variables in this file */
import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
	IForgetPasswordPayload,
	IGooglePayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IverifyEmailPayload,
} from "./auth.interface";
import { googleClient } from "../../lib/googleAuth";
import type { TokenPayload } from "google-auth-library";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";
import path from "path";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);
	const expirationSeconds = 5 * 60; // 5 minutes

	const otpValue = crypto.randomInt(100000, 1000000).toString();
	const otpKey = `User-Registration-otp:${email}`;

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const patientRegistrationKey = `User-Registration-data:${email}`;
	const patientRegistrationData = {
		name,
		email,
		password: hashedPassword,
		patient: patientData,
	};

	await redisClient.set(
		patientRegistrationKey,
		JSON.stringify(patientRegistrationData),
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	const templetePath = path.join(
		process.cwd(),
		"src/app/templates/user-registration.ejs",
	);

	const html = await ejs.renderFile(templetePath, {
		name,
		email,
		otpValue,
		expirationMinutes: expirationSeconds / 60,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email Verification OTP",
		html,
	});
};

const verifyPatientEmail = async (payload: IverifyEmailPayload) => {
	const otp = payload.otp;

	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists?.status === "BLOCKED") {
		throw new Error("User is blocked");
	}

	if (isUserExists?.isDeleted || isUserExists?.status === "DELETED") {
		throw new Error("User is deleted");
	}

	if (isUserExists?.googleid && isUserExists?.authProivider === "GOOGLE") {
		throw new Error("User has registered with Google account");
	}

	if (isUserExists?.emailVerified) {
		throw new Error("User email is already verified");
	}

	const otpKey = `User-Registration-otp:${email}`;
	const redisOTP = await redisClient.get(otpKey);
	if (!redisOTP) {
		throw new Error("OTP is invalid or has expired");
	}
	if (redisOTP !== otp) {
		throw new Error("OTP is incorrect");
	}

	await redisClient.del([otpKey]);

	const patientRegistrationKey = `User-Registration-data:${email}`;
	const patientRegistrationDataString = await redisClient.get(
		patientRegistrationKey,
	);

	if (!patientRegistrationDataString) {
		throw new Error("Patient registration data not found");
	}

	const patientDataPayload: IRegisterPatientPayload = JSON.parse(
		patientRegistrationDataString,
	);

	const createdUser = await prisma.user.create({
		data: {
			name: patientDataPayload.name,
			email: patientDataPayload.email,
			password: patientDataPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: {
					name: patientDataPayload.name,
					email: patientDataPayload.email,
					contactNumber: patientDataPayload?.patient?.contactNumber,
				},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	await redisClient.del([patientRegistrationKey]);

	const templetePath = path.join(
		process.cwd(),
		"src/app/templates/patient-welcome-email.ejs",
	);

	const html = await ejs.renderFile(templetePath, {
		name: createdUser.name,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: createdUser.email,
		subject: "Welcome to Medi care System",
		html,
	});

	const { patient, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if (user.password === null && user.googleid !== null) {
		throw new Error("User registered with Google. Please login with Google.");
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IGooglePayload) => {
	let googleIdTokenPayload: TokenPayload | undefined | null = null;
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.log("Google ID token varification failed", error);
		throw new Error("Google ID token varification failed");
	}

	if (!googleIdTokenPayload) {
		throw new Error("Google ID token payload is empty");
	}

	if (!googleIdTokenPayload.email) {
		throw new Error("Google ID token payload does not contain email");
	}

	if (!googleIdTokenPayload.name) {
		throw new Error("Google ID token payload does not contain name");
	}

	const isPatientExistsWithGoogleAuth = await prisma.user.findUnique({
		where: {
			email: googleIdTokenPayload.email,
			role: Role.PATIENT,
			googleid: googleIdTokenPayload.sub,
		},
	});

	let user = isPatientExistsWithGoogleAuth;

	if (!isPatientExistsWithGoogleAuth) {
		const isPatientExistsWithCredential = await prisma.user.findUnique({
			where: {
				email: googleIdTokenPayload.email,
				role: Role.PATIENT,
				authProivider: AuthProvider.CREDENTIAL,
			},
		});

		if (isPatientExistsWithCredential) {
			if (!isPatientExistsWithCredential.emailVerified) {
				throw new Error("User email is not verified");
			}

			if (isPatientExistsWithCredential.status === "BLOCKED") {
				throw new Error("User is blocked");
			}

			if (
				isPatientExistsWithCredential.isDeleted ||
				isPatientExistsWithCredential.status === "DELETED"
			) {
				throw new Error("User is deleted");
			}

			user = await prisma.user.update({
				where: {
					id: isPatientExistsWithCredential.id,
				},
				data: {
					googleid: googleIdTokenPayload.sub,
				},
			});
		} else {
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: googleIdTokenPayload.email,
					role: Role.PATIENT,
					googleid: googleIdTokenPayload.sub,
					authProivider: AuthProvider.GOOGLE,
					emailVerified: true,
					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: googleIdTokenPayload.email,
						},
					},
				},
			});
			const templetePath = path.join(
				process.cwd(),
				"src/app/templates/patient-welcome-email.ejs",
			);

			const html = await ejs.renderFile(templetePath, {
				name: user.name,
			});

			await transporter.sendMail({
				from: config.email_sender,
				to: user.email,
				subject: "Welcome to Medi care System",
				html,
			});
		}
	}

	if (!user) {
		throw new Error("User creation or retrieval failed");
	}

	if (user.status === "BLOCKED") {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === "DELETED") {
		throw new Error("User is deleted");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const forgetPasseord = async (payload: IForgetPasswordPayload) => {
	const { email } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	if (isUserExists.status === "BLOCKED") {
		throw new Error("User is blocked");
	}

	if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
		throw new Error("User is deleted");
	}

	if (isUserExists.googleid && isUserExists.authProivider === "GOOGLE") {
		throw new Error("User has registered with Google account");
	}

	if (!isUserExists.emailVerified) {
		throw new Error("User email is not verified");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();

	const key = `forget-password-otp:${isUserExists.email}`;

	const expirationSeconds = 5 * 60; // 5 minutes

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const templetePath = path.join(
		process.cwd(),
		"src/app/templates/forget-password.ejs",
	);

	const html = await ejs.renderFile(templetePath, {
		name: isUserExists.name,
		otp,
		expirationMinutes: expirationSeconds / 60,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Forget Password OTP",
		html,
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, newPassword } = payload;

	const isUserExists = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	if (isUserExists.status === "BLOCKED") {
		throw new Error("User is blocked");
	}

	if (isUserExists.isDeleted || isUserExists.status === "DELETED") {
		throw new Error("User is deleted");
	}

	if (isUserExists.googleid && isUserExists.authProivider === "GOOGLE") {
		throw new Error("User has registered with Google account");
	}

	if (!isUserExists.emailVerified) {
		throw new Error("User email is not verified");
	}

	const key = `forget-password-otp:${isUserExists.email}`;

	const redisOTP = await redisClient.get(key);

	if (!redisOTP) {
		throw new Error("OTP is invalid or has expired");
	}

	if (redisOTP !== otp) {
		throw new Error("OTP is incorrect");
	}

	const hashedNewPassword = await bcrypt.hash(
		newPassword,
		Number(config.bcrypt_salt_rounds),
	);

	await prisma.user.update({
		where: {
			email: isUserExists.email,
		},
		data: {
			password: hashedNewPassword,
		},
	});
	await redisClient.del([key]);

	const templetePath = path.join(
		process.cwd(),
		"src/app/templates/reset-password-success.ejs",
	);

	const html = await ejs.renderFile(templetePath, {
		name: isUserExists.name,
	});

	await transporter.sendMail({
		from: config.email_sender,
		to: isUserExists.email,
		subject: "Password Reset Successful",
		html,
	});
};

export const AuthService = {
	registerPatient,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgetPasseord,
	resetPassword,
	verifyPatientEmail,
};
