package com.voxroyale.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFFF5F6FA)
private val SurfaceWhite = Color.White
private val Brand = Color(0xFF3478F6)
private val TextMain = Color(0xFF202638)
private val TextMuted = Color(0xFF8991A3)
private val Line = Color(0xFFE9ECF2)

internal enum class Destination(val label: String) {
    Chats("الرسائل"), Rooms("الغرف"), Discover("اكتشف"), Moments("اللحظات"), Me("أنا")
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { VoxRoyaleApp() }
    }
}

@Composable
private fun VoxRoyaleApp() {
    var destination by remember { mutableStateOf(Destination.Discover) }
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Brand,
            background = Ink,
            surface = SurfaceWhite,
            onPrimary = Color.White,
            onBackground = TextMain,
            onSurface = TextMain
        )
    ) {
        Scaffold(
            containerColor = Ink,
            bottomBar = {
                NavigationBar(containerColor = SurfaceWhite, tonalElevation = 8.dp) {
                    Destination.values().forEach { item ->
                        val icon = when (item) {
                            Destination.Chats -> Icons.Default.ChatBubbleOutline
                            Destination.Rooms -> Icons.Default.Mic
                            Destination.Discover -> Icons.Default.Explore
                            Destination.Moments -> Icons.Default.DynamicFeed
                            Destination.Me -> Icons.Default.PersonOutline
                        }
                        NavigationBarItem(
                            selected = destination == item,
                            onClick = { destination = item },
                            icon = { Icon(icon, contentDescription = item.label) },
                            label = { Text(item.label, fontSize = 10.sp) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Brand,
                                selectedTextColor = Brand,
                                indicatorColor = Color(0xFFEAF1FF),
                                unselectedIconColor = TextMuted,
                                unselectedTextColor = TextMuted
                            )
                        )
                    }
                }
            }
        ) { padding ->
            when (destination) {
                Destination.Discover -> DiscoverScreen(Modifier.padding(padding), onRooms = { destination = Destination.Rooms })
                Destination.Rooms -> RoomsScreen(Modifier.padding(padding))
                Destination.Chats -> ChatsScreen(Modifier.padding(padding))
                Destination.Moments -> MomentsScreen(Modifier.padding(padding))
                Destination.Me -> ProfileScreen(Modifier.padding(padding))
            }
        }
    }
}

@Composable
private fun DiscoverScreen(modifier: Modifier = Modifier, onRooms: () -> Unit) {
    LazyColumn(modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 18.dp, bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("VOX ROYALE", color = Brand, fontSize = 21.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
                    Text("تواصل، شارك، واكتشف", color = TextMuted, fontSize = 11.sp)
                }
                IconButton(onClick = {}) { Icon(Icons.Default.Search, "بحث", tint = TextMain) }
                IconButton(onClick = {}) { Icon(Icons.Default.NotificationsNone, "الإشعارات", tint = TextMain) }
            }
        }
        item {
            Surface(color = Color(0xFFEAF1FF), shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
                Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("مساحتك للتواصل", color = TextMain, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(5.dp))
                        Text("انضم إلى محادثة صوتية أو تواصل مع أصدقائك", color = TextMuted, fontSize = 12.sp)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = onRooms, shape = RoundedCornerShape(12.dp)) {
                            Icon(Icons.Default.Mic, null, Modifier.size(17.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("اكتشف الغرف")
                        }
                    }
                    Icon(Icons.Default.Groups, null, tint = Brand, modifier = Modifier.size(58.dp))
                }
            }
        }
        item { BackendConfigurationNotice() }
        item { SectionTitle("الوصول السريع") }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                QuickAction("محادثات", Icons.Default.Chat, Modifier.weight(1f))
                QuickAction("مكالمات", Icons.Default.Call, Modifier.weight(1f))
                QuickAction("ألعاب", Icons.Default.SportsEsports, Modifier.weight(1f))
                QuickAction("اللحظات", Icons.Default.PhotoLibrary, Modifier.weight(1f))
            }
        }
        item { SectionTitle("الغرف الصوتية", "عرض الكل", onRooms) }
        item { EmptyPanel("الغرف ستظهر هنا", "عند تفعيل خدمة الغرف المباشرة وربط حسابك") }
        item { SectionTitle("الأصدقاء المقترحون") }
        item { EmptyPanel("اكتشف أشخاصًا جددًا", "سجّل الدخول لعرض اقتراحات مبنية على بيانات الخدمة") }
        item { SectionTitle("الألعاب") }
        item { EmptyPanel("مركز الألعاب", "الألعاب ستظهر بعد ربط جلسات اللعب والخدمات") }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoomsScreen(modifier: Modifier = Modifier) {
    var selected by remember { mutableStateOf("الكل") }
    val filters = listOf("الكل", "نشطة", "جديدة", "أتابعها")
    Column(modifier.fillMaxSize()) {
        ScreenHeader("الغرف الصوتية", "اكتشف المحادثات المباشرة")
        ScrollableTabRow(selectedTabIndex = filters.indexOf(selected), containerColor = Ink, contentColor = Brand, edgePadding = 16.dp) {
            filters.forEach { filter -> Tab(selected == filter, { selected = filter }, text = { Text(filter) }) }
        }
        Column(Modifier.padding(16.dp)) {
            EmptyPanel("لا توجد غرف معروضة", "سيتم تحميل الغرف الحقيقية من الخادم. لا نعرض غرفًا أو أعضاءً تجريبيين.")
        }
    }
}

@Composable
private fun ChatsScreen(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenHeader("الرسائل", "محادثاتك ومكالماتك")
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AssistChip(onClick = {}, label = { Text("الكل") }, leadingIcon = { Icon(Icons.Default.Chat, null) })
            AssistChip(onClick = {}, label = { Text("غير مقروءة") })
            AssistChip(onClick = {}, label = { Text("المكالمات") }, leadingIcon = { Icon(Icons.Default.Call, null) })
        }
        Column(Modifier.padding(16.dp)) {
            EmptyPanel("لا توجد محادثات للعرض", "سجّل الدخول لعرض رسائلك ومكالماتك الفعلية بأمان.")
        }
    }
}

@Composable
private fun MomentsScreen(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenHeader("اللحظات", "شارك الصور والفيديوهات مع مجتمعك")
        Surface(color = SurfaceWhite, shape = RoundedCornerShape(16.dp), modifier = Modifier.padding(16.dp).fillMaxWidth()) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AddCircleOutline, null, tint = Brand, modifier = Modifier.size(28.dp))
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("أنشئ لحظتك", color = TextMain, fontWeight = FontWeight.SemiBold)
                    Text("انشر صورة أو فيديو بعد تسجيل الدخول", color = TextMuted, fontSize = 11.sp)
                }
            }
        }
        Column(Modifier.padding(horizontal = 16.dp)) {
            EmptyPanel("لا توجد لحظات للعرض", "ستظهر منشورات الأصدقاء من الخادم بعد ربط الحساب.")
        }
    }
}

@Composable
private fun ProfileScreen(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxSize()) {
        ScreenHeader("حسابي", "ملفك الشخصي وإعداداتك")
        Surface(color = SurfaceWhite, shape = RoundedCornerShape(18.dp), modifier = Modifier.padding(16.dp).fillMaxWidth()) {
            Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(76.dp).background(Color(0xFFEAF1FF), CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Person, null, tint = Brand, modifier = Modifier.size(38.dp))
                }
                Spacer(Modifier.height(10.dp))
                Text("ملف VOX ROYALE", color = TextMain, fontWeight = FontWeight.Bold)
                Text("سجّل الدخول لعرض بيانات حسابك", color = TextMuted, fontSize = 12.sp)
                Spacer(Modifier.height(12.dp))
                Button(onClick = {}, shape = RoundedCornerShape(12.dp)) { Text("تسجيل الدخول") }
            }
        }
        ProfileRow(Icons.Default.AccountBalanceWallet, "المحفظة", "الرصيد وسجل المعاملات")
        ProfileRow(Icons.Default.StarOutline, "العضوية المميزة", "مزايا واشتراكات VIP")
        ProfileRow(Icons.Default.Inventory2, "ممتلكاتي", "الإطارات والهدايا والعناصر")
        ProfileRow(Icons.Default.Settings, "الإعدادات", "الخصوصية واللغة والأمان")
        ProfileRow(Icons.Default.HelpOutline, "المساعدة", "الدعم والإبلاغ")
    }
}

@Composable
private fun ScreenHeader(title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 18.dp)) {
        Text(title, color = TextMain, fontSize = 23.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = TextMuted, fontSize = 12.sp)
    }
}

@Composable
private fun SectionTitle(title: String, action: String? = null, onAction: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 22.dp, bottom = 11.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = TextMain, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (action != null) Text(action, color = Brand, fontSize = 12.sp, modifier = Modifier.clickable { onAction?.invoke() })
    }
}

@Composable
private fun QuickAction(label: String, icon: androidx.compose.ui.graphics.vector.ImageVector, modifier: Modifier = Modifier) {
    Surface(color = SurfaceWhite, shape = RoundedCornerShape(14.dp), modifier = modifier) {
        Column(Modifier.padding(vertical = 13.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, tint = Brand, modifier = Modifier.size(22.dp))
            Spacer(Modifier.height(6.dp))
            Text(label, color = TextMain, fontSize = 10.sp, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun EmptyPanel(title: String, description: String) {
    Surface(color = SurfaceWhite, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(17.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).background(Color(0xFFEAF1FF), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.CloudOff, null, tint = Brand)
            }
            Spacer(Modifier.width(13.dp))
            Column {
                Text(title, color = TextMain, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Spacer(Modifier.height(4.dp))
                Text(description, color = TextMuted, fontSize = 11.sp, lineHeight = 16.sp)
            }
        }
    }
}

@Composable
private fun ProfileRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) {
    Surface(color = SurfaceWhite, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 3.dp), shape = RoundedCornerShape(12.dp)) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = Brand)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, color = TextMain, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                Text(subtitle, color = TextMuted, fontSize = 10.sp)
            }
            Icon(Icons.Default.ChevronRight, null, tint = TextMuted)
        }
    }
}

@Composable
private fun BackendConfigurationNotice() {
    val configured = SupabaseRuntimeConfig.isConfigured
    Surface(
        color = if (configured) Color(0xFFEAF7F0) else Color(0xFFFFF5E8),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                if (configured) Icons.Default.SettingsSuggest else Icons.Default.CloudOff,
                contentDescription = null,
                tint = if (configured) Color(0xFF218653) else Color(0xFFB87520)
            )
            Spacer(Modifier.width(10.dp))
            Column {
                Text(
                    if (configured) "إعدادات Supabase متوفرة" else "يلزم إعداد اتصال Supabase",
                    color = TextMain,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    if (configured) "تم العثور على عنوان المشروع ومفتاح النشر؛ لم يتم بعد تأكيد الاتصال بالخادم."
                    else "أضف SUPABASE_URL وSUPABASE_PUBLISHABLE_KEY إلى إعدادات البناء لتفعيل خدمات الحساب.",
                    color = TextMuted,
                    fontSize = 10.sp,
                    lineHeight = 15.sp
                )
            }
        }
    }
}
