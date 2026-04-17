import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw err || new Error('Unauthorized');
    }
    
    if (user.role !== 'ADMIN') {
      throw new Error('Admin access required');
    }
    
    return user;
  }
}
