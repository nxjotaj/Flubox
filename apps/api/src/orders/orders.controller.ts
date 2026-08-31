import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Public, Roles } from '../auth/auth.decorators';
import { CreateOrderDto, ManualPaymentDto, ShipOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';
@Controller('orders') export class OrdersController { constructor(private service:OrdersService){}
 @Get() list(@Req() r:any,@Query('status') s?:string){return this.service.list(r.user,s)}
 @Get(':id') find(@Param('id') id:string,@Req() r:any){return this.service.find(id,r.user)}
 @Post() @Roles('SELLER') create(@Body() d:CreateOrderDto,@Req() r:any){return this.service.create(d,r.user.id)}
 @Patch(':id/ship') @Roles('ADMIN','OPERATOR') ship(@Param('id') id:string,@Body() d:ShipOrderDto,@Req() r:any){return this.service.ship(id,d,r.user.id)}
 @Patch('payments/:id/review') @Roles('ADMIN') review(@Param('id') id:string,@Body() d:ManualPaymentDto,@Req() r:any){return this.service.review(id,d,r.user.id)}
 @Public() @Post('webhooks/simulated/:id') webhook(@Param('id') id:string,@Body('amount') amount:number){return this.service.confirm(id,amount)}
}
