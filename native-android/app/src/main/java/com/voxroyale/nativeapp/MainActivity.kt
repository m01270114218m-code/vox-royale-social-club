package com.voxroyale.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF10172A)
private val Panel = Color(0xFF1B2540)
private val Gold = Color(0xFFE9B85B)
private val Muted = Color(0xFF9BA8C2)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { VoxRoyaleApp() }
    }
}

@Composable
private fun VoxRoyaleApp() {
    var selected by remember { mutableStateOf(0) }
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Gold,
            background = Ink,
            surface = Panel,
            onBackground = Color.White,
            onSurface = Color.White
        )
    ) {
        Scaffold(
            containerColor = Ink,
            bottomBar = {
                NavigationBar(containerColor = Panel, contentColor = Gold) {
                    val items = listOf(
                        "الرئيسية" to Icons.Default.Home,
                        "الغرف" to Icons.Default.Mic,
                        "الألعاب" to Icons.Default.SportsEsports,
                        "الرسائل" to Icons.Default.Chat,
                        "حسابي" to Icons.Default.Person
                    )
                    items.forEachIndexed { index, item ->
                        NavigationBarItem(
                            selected = selected == index,
                            onClick = { selected = index },
                            icon = { Icon(item.second, contentDescription = item.first) },
                            label = { Text(item.first, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Gold,
                                selectedTextColor = Gold,
                                indicatorColor = Color(0xFF35415D),
                                unselectedIconColor = Muted,
                                unselectedTextColor = Muted
                            )
                        )
                    }
                }
            }
        ) { padding ->
            when (selected) {
                0 -> HomeScreen(Modifier.padding(padding))
                1 -> RoomsScreen(Modifier.padding(padding))
                2 -> EmptySection("الألعاب", "ستظهر الألعاب المتصلة بالخادم هنا", Modifier.padding(padding))
                3 -> EmptySection("الرسائل", "سجّل الدخول لعرض محادثاتك", Modifier.padding(padding))
                else -> EmptySection("حسابي", "ملفك الشخصي ومحفظتك وإعدادات VIP", Modifier.padding(padding))
            }
        }
    }
}

@Composable
private fun HomeScreen(modifier: Modifier = Modifier) {
    LazyColumn(modifier.fillMaxSize().padding(horizontal = 18.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("VOX ROYALE", color = Gold, fontSize = 22.sp, fontWeight = FontWeight.Black, letterSpacing = 1.5.sp)
                    Text("مجتمعك الصوتي", color = Muted, fontSize = 12.sp)
                }
                IconButton(onClick = {}) { Icon(Icons.Default.NotificationsNone, null, tint = Color.White) }
                IconButton(onClick = {}) { Icon(Icons.Default.Search, null, tint = Color.White) }
            }
        }
        item {
            Surface(color = Panel, shape = RoundedCornerShape(22.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Text("اكتشف مجتمعك", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(6.dp))
                    Text("ادخل غرفة صوتية، قابل أصدقاء جدد وشارك لحظاتك", color = Muted, fontSize = 13.sp)
                    Spacer(Modifier.height(14.dp))
                    Button(onClick = {}, colors = ButtonDefaults.buttonColors(containerColor = Gold, contentColor = Ink)) {
                        Icon(Icons.Default.Mic, null)
                        Spacer(Modifier.width(8.dp))
                        Text("استكشف الغرف")
                    }
                }
            }
        }
        item { SectionHeader("الغرف الصوتية", "عرض الكل") }
        item { EmptyCard("لا توجد غرف متاحة للعرض الآن", "عند ربط خدمة الغرف ستظهر الغرف النشطة هنا") }
        item { SectionHeader("الألعاب", "قريبًا") }
        item { EmptyCard("مركز الألعاب", "ستُعرض الألعاب المتاحة بعد ربط خدماتها") }
    }
}

@Composable
private fun RoomsScreen(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().padding(18.dp)) {
        Text("الغرف الصوتية", color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Text("اكتشف المحادثات المباشرة", color = Muted, fontSize = 13.sp)
        Spacer(Modifier.height(18.dp))
        EmptyCard("لا توجد غرف متاحة حاليًا", "قائمة الغرف ستُحمّل من خدمة الغرف الحقيقية بعد توصيل واجهة API")
    }
}

@Composable
private fun EmptySection(title: String, description: String, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize().padding(22.dp)) {
        Text(title, color = Color.White, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(14.dp))
        EmptyCard(title, description)
    }
}

@Composable
private fun SectionHeader(title: String, action: String) {
    Row(Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        Text(action, color = Gold, fontSize = 12.sp)
    }
}

@Composable
private fun EmptyCard(title: String, description: String) {
    Surface(color = Panel, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).background(Color(0xFF303D5C), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Mic, null, tint = Gold)
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Text(title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Spacer(Modifier.height(4.dp))
                Text(description, color = Muted, fontSize = 11.sp, lineHeight = 16.sp)
            }
        }
    }
}
