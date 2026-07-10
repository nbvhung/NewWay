import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingLinesController } from './shipping-lines.controller';
import { ShippingLinesService } from './shipping-lines.service';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShippingLine, Route])],
  controllers: [ShippingLinesController],
  providers: [ShippingLinesService],
})
export class ShippingLinesModule {}
