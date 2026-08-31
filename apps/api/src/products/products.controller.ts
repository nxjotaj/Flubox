import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/auth.decorators';
import {
  CreateProductDto,
  StockAdjustmentDto,
  UpdateProductDto,
} from './products.dto';
import { ProductsService } from './products.service';
@ApiTags('Produtos')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private service: ProductsService) {}
  @Get() list(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list(search, status);
  }
  @Get(':id') find(@Param('id') id: string) {
    return this.service.find(id);
  }
  @Roles(Role.ADMIN, Role.OPERATOR) @Post() create(
    @Body() dto: CreateProductDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.create(dto, req.user.id);
  }
  @Roles(Role.ADMIN, Role.OPERATOR) @Put(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.update(id, dto, req.user.id);
  }
  @Roles(Role.ADMIN, Role.OPERATOR) @Post(':id/stock-movements') adjust(
    @Param('id') id: string,
    @Body() dto: StockAdjustmentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.adjust(id, dto, req.user.id);
  }
  @Roles(Role.ADMIN) @Delete(':id') archive(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.service.archive(id, req.user.id);
  }
}
