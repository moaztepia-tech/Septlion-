import { Injectable } from '@nestjs/common'; import { PassportStrategy } from '@nestjs/passport'; import { Strategy, Profile } from 'passport-google-oauth20';
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy,'google'){
 constructor(){super({clientID:process.env.GOOGLE_CLIENT_ID||'disabled',clientSecret:process.env.GOOGLE_CLIENT_SECRET||'disabled',callbackURL:process.env.GOOGLE_CALLBACK_URL||'http://localhost:4000/api/auth/google/callback',scope:['email','profile']});}
 validate(_accessToken:string,_refreshToken:string,profile:Profile,done:(err:any,user?:any)=>void){done(null,{provider:'google',providerId:profile.id,email:profile.emails?.[0]?.value,firstName:profile.name?.givenName,lastName:profile.name?.familyName});}
}
