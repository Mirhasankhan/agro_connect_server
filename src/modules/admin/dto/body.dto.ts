import { IsBoolean, IsOptional, IsString,  IsMongoId, } from "class-validator";

export class AcceptRejectProducerAccountDto {

    @IsMongoId()
    producerId: string

    @IsBoolean()
    isAccept: boolean

    @IsOptional()
    @IsString()
    rejectReason?: string
}


export class CategoryDto {
    @IsString()
    name: string;

    @IsString()
    slug: string;

    @IsString()
    description: string;
    
}