package com.voxroyale.nativeapp

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationDestinationTest {
    @Test
    fun primaryNavigationContainsFiveExpectedSections() {
        assertEquals(5, Destination.values().size)
        assertEquals(
            listOf("الرسائل", "الغرف", "اكتشف", "اللحظات", "أنا"),
            Destination.values().map { it.label }
        )
    }

    @Test
    fun navigationDestinationNamesAreUnique() {
        val labels = Destination.values().map { it.label }
        assertEquals(labels.size, labels.toSet().size)
        assertTrue(labels.none { it.isBlank() })
    }
}
