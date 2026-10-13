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

export class SendSupportDto {
    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    message: string;
}
