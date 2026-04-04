import { loadAccountProfile } from './accountProfile';

const accountProfile = loadAccountProfile();

export const config = {
  renderFormat: 'mp4',
  brandAccentColor: accountProfile.accentColor,
  brandHandle: accountProfile.handle,
  brandEffects: accountProfile.effects,
  // Full account profile for AI context
  accountProfile,
};
