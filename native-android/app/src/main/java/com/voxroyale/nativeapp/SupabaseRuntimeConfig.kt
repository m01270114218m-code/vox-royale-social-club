package com.voxroyale.nativeapp

internal object SupabaseRuntimeConfig {
    val isConfigured: Boolean
        get() = BuildConfig.SUPABASE_URL.startsWith("https://") &&
            BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()

    val missingItems: List<String>
        get() = buildList {
            if (!BuildConfig.SUPABASE_URL.startsWith("https://")) add("SUPABASE_URL")
            if (BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank()) add("SUPABASE_PUBLISHABLE_KEY")
        }
}
