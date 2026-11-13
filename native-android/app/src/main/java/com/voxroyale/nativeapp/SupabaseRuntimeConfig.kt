package com.voxroyale.nativeapp

internal object SupabaseRuntimeConfig {
    fun missingConfigurationItems(url: String, publishableKey: String): List<String> =
        buildList {
            if (!url.startsWith("https://")) add("SUPABASE_URL")
            if (publishableKey.isBlank()) add("SUPABASE_PUBLISHABLE_KEY")
        }

    val isConfigured: Boolean
        get() = missingConfigurationItems(
            BuildConfig.SUPABASE_URL,
            BuildConfig.SUPABASE_PUBLISHABLE_KEY
        ).isEmpty()

    val missingItems: List<String>
        get() = missingConfigurationItems(
            BuildConfig.SUPABASE_URL,
            BuildConfig.SUPABASE_PUBLISHABLE_KEY
        )
}
