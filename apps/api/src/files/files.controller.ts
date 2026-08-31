import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileKind } from '@prisma/client';
import { FilesService } from './files.service';
import { Roles } from '../auth/auth.decorators';
@Controller()
export class FilesController {
  constructor(private s: FilesService) {}
  @Post('orders/:id/files/:kind')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10485760 } }))
  upload(
    @Param('id') id: string,
    @Param('kind') kind: FileKind,
    @UploadedFile() file: Express.Multer.File,
    @Req() r: any,
  ) {
    return this.s.upload(id, kind, file, r.user);
  }
  @Get('files/:id/url') url(@Param('id') id: string, @Req() r: any) {
    return this.s.url(id, r.user);
  }
  @Roles('ADMIN','OPERATOR') @Post('products/:id/images') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:10485760}})) productImage(@Param('id')id:string,@UploadedFile()file:Express.Multer.File,@Req()r:any){return this.s.productImage(id,file,r.user.id)}
  @Roles('ADMIN','OPERATOR') @Patch('products/:id/images/:fileId/primary') primary(@Param('id')id:string,@Param('fileId')fileId:string){return this.s.primaryImage(id,fileId)}
  @Roles('ADMIN') @Delete('products/:id/images/:fileId') remove(@Param('id')id:string,@Param('fileId')fileId:string,@Req()r:any){return this.s.deleteProductImage(id,fileId,r.user.id)}
}
