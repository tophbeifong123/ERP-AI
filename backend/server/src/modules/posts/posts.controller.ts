import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OwnerGuard } from '../../common/guards/owner.guard';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResourceType } from '../../common/decorators/resource-type.decorator';
import { PostsService, CreatePostDto, UpdatePostDto } from './posts.service';
import { PostStatus } from '../../database/entities/post.entity';
import { RejectionReason } from '../../database/entities/post.entity';

@Controller('posts')
@UseGuards(EmailVerifiedGuard)
export class PostsController {
  constructor(private postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    const post = await this.postsService.create(userId, dto);
    return { post };
  }

  @Get()
  async list(
    @Query('businessId') businessId?: string,
    @Query('status') status?: PostStatus,
    @Query('postType') postType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const posts = await this.postsService.list({
      businessId,
      status,
      postType,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    return { posts };
  }

  @Get(':id')
  @UseGuards(OwnerGuard)
  @ResourceType('post')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    const post = await this.postsService.getOne(id);
    return { post };
  }

  @Patch(':id')
  @UseGuards(OwnerGuard)
  @ResourceType('post')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    const post = await this.postsService.update(id, dto);
    return { post };
  }

  @Post(':id/approve')
  @UseGuards(OwnerGuard)
  @ResourceType('post')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id', new ParseUUIDPipe()) id: string) {
    const post = await this.postsService.approve(id);
    return { post };
  }

  @Post(':id/reject')
  @UseGuards(OwnerGuard)
  @ResourceType('post')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason?: RejectionReason },
  ) {
    const post = await this.postsService.reject(id, body?.reason);
    return { post };
  }

  @Delete(':id')
  @UseGuards(OwnerGuard)
  @ResourceType('post')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    await this.postsService.softDelete(id);
    return;
  }
}
