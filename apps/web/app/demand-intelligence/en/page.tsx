'use client';
import {useEffect} from 'react';

// The radar is for the Septlion team only; this old public address now goes to the team page.
export default function Redirect(){useEffect(()=>{window.location.replace('/demand-intelligence/')},[]);return <main className="ops" dir="rtl" style={{padding:24}}>جارٍ التحويل…</main>}
