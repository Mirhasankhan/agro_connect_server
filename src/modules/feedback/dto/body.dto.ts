import {
    IsMongoId,
    IsNotEmpty,
    IsNumber,
    IsString,
    Max,
    Min,
} from "class-validator";

export class CreateReviewDto {
    @IsNumber()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    comment: string;

    @IsMongoId()
    orderItemId: string;
}
export class CreateDriverReviewDto {
    @IsNumber()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    comment: string;

    @IsMongoId()
    orderId: string;
}

export class SendSupportDto {
    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    message: string;
}
