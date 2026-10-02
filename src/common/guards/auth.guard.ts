// import {
//     CanActivate,
//     ExecutionContext,
//     Injectable,
//     UnauthorizedException,
//     ForbiddenException,
// } from "@nestjs/common";
// import { JwtService } from "@nestjs/jwt";
// import { Request } from "express";
// import { Reflector } from "@nestjs/core";
// import { IS_PUBLIC_KEY } from "@/common/decorators/auth.decorator";
// import config from "@/config";
// import { PrismaService } from "@/core/services/prisma/prisma.service";
// import { UserRole } from "@prisma/client";
// import { ROLES_KEY } from "../decorators/roles.decorator";

// @Injectable()
// export class AuthGuard implements CanActivate {
//     constructor(
//         private jwtService: JwtService,
//         private reflector: Reflector,
//         private prisma: PrismaService,
//     ) {}

//     async canActivate(context: ExecutionContext): Promise<boolean> {
//         const isPublic = this.reflector.getAllAndOverride<boolean>(
//             IS_PUBLIC_KEY,
//             [context.getHandler(), context.getClass()],
//         );

//         if (isPublic) {
//             return true;
//         }

//         const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
//             ROLES_KEY,
//             [context.getHandler(), context.getClass()],
//         );

//         const request = context.switchToHttp().getRequest<Request>();
//         const token = this.extractTokenFromHeader(request);

//         if (!token) {
//             throw new UnauthorizedException("Invalid token");
//         }

//         let payload: {
//             id: string;
//         };

//         try {
//             payload = await this.jwtService.verifyAsync(token, {
//                 secret: config.jwt.jwt_secret,
//             });
//         } catch {
//             throw new UnauthorizedException("Invalid token");
//         }

//         const user = await this.prisma.user.findUnique({
//             where: {
//                 id: payload.id,
//             },
//             select: {
//                 id: true,
//                 email: true,
//                 role: true,
//                 status: true,
//                 deleted: true,
//             },
//         });

//         if (!user || user.deleted) {
//             throw new UnauthorizedException("Unauthorized request");
//         }

//         if (user.status === "INACTIVE") {
//             throw new UnauthorizedException("User is inactive");
//         }

//         if (
//             requiredRoles?.length &&
//             !requiredRoles.includes(user.role)
//         ) {
//             throw new ForbiddenException("Insufficient permissions");
//         }

//         request["user"] = {
//             id: user.id,
//             email: user.email,
//             role: user.role,
//         };

//         return true;
//     }

//     private extractTokenFromHeader(
//         request: Request,
//     ): string | undefined {
//         const authorization = request.headers.authorization;

//         if (!authorization) {
//             return undefined;
//         }

//         const [type, token] = authorization.split(" ");

//         if (type !== "Bearer" || !token) {
//             return undefined;
//         }

//         return token;
//     }
// }

// export type UserPayload = {
//     id: string;
//     email: string;
//     role: UserRole;
// };

import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import {
    IS_PUBLIC_KEY,
    IS_OPTIONAL_AUTH_KEY,
} from "@/common/decorators/auth.decorator";
import config from "@/config";
import { PrismaService } from "@/core/services/prisma/prisma.service";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private jwtService: JwtService,
        private reflector: Reflector,
        private prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (isPublic) {
            return true;
        }

        const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
            IS_OPTIONAL_AUTH_KEY,
            [context.getHandler(), context.getClass()],
        );

        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            if (isOptionalAuth) {
                return true;
            }

            throw new UnauthorizedException("Invalid token");
        }

        let payload: {
            id: string;
        };

        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: config.jwt.jwt_secret,
            });
        } catch {
            throw new UnauthorizedException("Invalid token");
        }

        const user = await this.prisma.user.findUnique({
            where: {
                id: payload.id,
            },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
                deleted: true,
            },
        });

        if (!user || user.deleted) {
            throw new UnauthorizedException("Unauthorized request");
        }

        if (user.status === "INACTIVE") {
            throw new UnauthorizedException("User is inactive");
        }

        if (requiredRoles?.length && !requiredRoles.includes(user.role)) {
            throw new ForbiddenException("Insufficient permissions");
        }

        request["user"] = {
            id: user.id,
            email: user.email,
            role: user.role,
        };

        return true;
    }

    private extractTokenFromHeader(request: Request): string | undefined {
        const authorization = request.headers.authorization;

        if (!authorization) {
            return undefined;
        }

        const [type, token] = authorization.split(" ");

        if (type !== "Bearer" || !token) {
            return undefined;
        }

        return token;
    }
}

export type UserPayload = {
    id: string;
    email: string;
    role: UserRole;
};
