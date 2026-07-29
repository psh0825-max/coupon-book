package com.lightonpluslab.couponbook.twa;

import android.app.Application;

import com.google.android.gms.ads.MobileAds;

/** Initializes the Google Mobile Ads (AdMob) SDK once for the process. */
public class App extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        MobileAds.initialize(this, initializationStatus -> { });
    }
}
