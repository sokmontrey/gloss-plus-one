import type { AuthUser, ProfileRepository } from '../../core/contracts/index.js'

export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async upsertFromAuthUser(user: AuthUser) {
    if (!user.email) throw new Error('Auth user missing email')
    return this.profileRepository.upsertFromAuthUser({
      authUserId: user.id,
      email: user.email,
    })
  }
}
