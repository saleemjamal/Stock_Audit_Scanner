# Native Android Implementation Guide
## Stock Audit Scanner System

**Based on existing React Native architecture**  
**Target: Single-platform production Android app**  
**Estimated Implementation Time: 3-4 weeks**

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Project Setup](#2-project-setup)
3. [Core Features Implementation](#3-core-features-implementation)
4. [UI/UX Implementation](#4-ui-ux-implementation)
5. [Data Management](#5-data-management)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Offline Sync Strategy](#7-offline-sync-strategy)
8. [Real-time Updates](#8-real-time-updates)
9. [USB Barcode Scanner Integration](#9-usb-barcode-scanner-integration)
10. [Testing Strategy](#10-testing-strategy)
11. [Deployment & Distribution](#11-deployment--distribution)
12. [Common Issues & Solutions](#12-common-issues--solutions)
13. [Migration Checklist](#13-migration-checklist)

---

## 1. Architecture Overview

### 1.1 High-Level Architecture Comparison

#### Current React Native Architecture
```
React Native App
├── JavaScript Layer (Business Logic)
├── React Navigation (Routing)
├── Redux Toolkit (State Management)
├── Metro Bundler (Build System)
├── Native Bridge (iOS/Android Interface)
└── Platform Specific Code (Java/Kotlin)
```

#### Proposed Native Android Architecture
```
Native Android App
├── Presentation Layer (Activities/Fragments + ViewModels)
├── Domain Layer (Use Cases + Repositories)
├── Data Layer (Room Database + Retrofit API)
├── DI Container (Dagger Hilt)
└── Background Services (Sync + Real-time)
```

### 1.2 Technology Stack Migration

| Feature | React Native | Native Android |
|---------|--------------|----------------|
| **Language** | TypeScript/JavaScript | Kotlin |
| **Architecture** | Redux + Hooks | MVVM + Clean Architecture |
| **Navigation** | React Navigation | Jetpack Navigation |
| **State Management** | Redux Toolkit | ViewModels + StateFlow |
| **Database** | SQLite (react-native-sqlite-storage) | Room Database |
| **HTTP Client** | Supabase Client | Retrofit + OkHttp |
| **Realtime** | Supabase Subscriptions | WebSocket Client |
| **Async Operations** | Promises/async-await | Coroutines + Flow |
| **Dependency Injection** | Manual | Dagger Hilt |
| **Build System** | Metro + Gradle | Gradle only |

---

## 2. Project Setup

### 2.1 Create New Android Project

```bash
# Using Android Studio
# File > New > New Project
# Choose "Empty Activity"
# Package name: com.stockaudit.scanner
# Language: Kotlin
# Minimum SDK: 26 (Android 8.0) - for USB OTG support
```

### 2.2 Dependencies (app/build.gradle)

```kotlin
dependencies {
    // Core Android
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.11.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    
    // Architecture Components
    implementation 'androidx.lifecycle:lifecycle-viewmodel-ktx:2.7.0'
    implementation 'androidx.lifecycle:lifecycle-livedata-ktx:2.7.0'
    implementation 'androidx.activity:activity-ktx:1.8.2'
    implementation 'androidx.fragment:fragment-ktx:1.6.2'
    
    // Navigation
    implementation 'androidx.navigation:navigation-fragment-ktx:2.7.6'
    implementation 'androidx.navigation:navigation-ui-ktx:2.7.6'
    
    // Room Database
    implementation 'androidx.room:room-runtime:2.6.1'
    implementation 'androidx.room:room-ktx:2.6.1'
    kapt 'androidx.room:room-compiler:2.6.1'
    
    // Network
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'com.squareup.okhttp3:logging-interceptor:4.12.0'
    
    // Dependency Injection
    implementation 'com.google.dagger:hilt-android:2.48.1'
    kapt 'com.google.dagger:hilt-compiler:2.48.1'
    
    // Reactive Streams
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3'
    
    // Authentication
    implementation 'com.google.android.gms:play-services-auth:20.7.0'
    
    // Barcode Scanning (ZXing)
    implementation 'com.journeyapps:zxing-android-embedded:4.3.0'
    implementation 'com.google.zxing:core:3.5.2'
    
    // WebSocket for Realtime
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
    
    // Preferences
    implementation 'androidx.datastore:datastore-preferences:1.0.0'
    
    // Work Manager (Background Sync)
    implementation 'androidx.work:work-runtime-ktx:2.9.0'
    
    // Testing
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
```

### 2.3 Application Configuration

#### AndroidManifest.xml
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.CAMERA" />
    
    <!-- USB OTG Support -->
    <uses-feature 
        android:name="android.hardware.usb.host" 
        android:required="false" />
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    
    <!-- Camera for barcode scanning -->
    <uses-feature 
        android:name="android.hardware.camera" 
        android:required="false" />
    <uses-feature 
        android:name="android.hardware.camera.autofocus" 
        android:required="false" />

    <application
        android:name=".StockAuditApplication"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.StockAudit"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".ui.MainActivity"
            android:exported="true"
            android:launchMode="singleTop">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            
            <!-- USB device attached -->
            <intent-filter>
                <action android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED" />
            </intent-filter>
            
            <meta-data 
                android:name="android.hardware.usb.action.USB_DEVICE_ATTACHED"
                android:resource="@xml/device_filter" />
        </activity>
        
        <!-- Background sync service -->
        <service
            android:name=".services.SyncService"
            android:enabled="true"
            android:exported="false" />
            
    </application>
</manifest>
```

---

## 3. Core Features Implementation

### 3.1 Application Class with Hilt

```kotlin
// StockAuditApplication.kt
@HiltAndroidApp
class StockAuditApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        
        // Initialize logging in debug mode
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }
    }
}
```

### 3.2 Data Models (Domain Layer)

```kotlin
// domain/model/User.kt
data class User(
    val id: String,
    val email: String,
    val fullName: String?,
    val role: UserRole,
    val locationIds: List<Int>,
    val deviceId: String?,
    val active: Boolean,
    val lastLogin: String?,
    val createdAt: String,
    val updatedAt: String
)

enum class UserRole {
    SCANNER, SUPERVISOR, ADMIN
}

// domain/model/Location.kt
data class Location(
    val id: Int,
    val name: String,
    val address: String?,
    val city: String?,
    val state: String?,
    val zipCode: String?,
    val active: Boolean,
    val createdAt: String,
    val updatedAt: String
)

// domain/model/AuditSession.kt
data class AuditSession(
    val id: String,
    val locationId: Int,
    val totalRackCount: Int,
    val status: AuditStatus,
    val startedAt: String?,
    val startedBy: String?,
    val completedAt: String?,
    val completedBy: String?,
    val notes: String?,
    val createdAt: String,
    val updatedAt: String
)

enum class AuditStatus {
    SETUP, ACTIVE, COMPLETED, CANCELLED
}

// domain/model/Rack.kt
data class Rack(
    val id: String,
    val auditSessionId: String,
    val locationId: Int,
    val rackNumber: String,
    val shelfNumber: String?,
    val status: RackStatus,
    val scannerId: String?,
    val assignedAt: String?,
    val readyForApproval: Boolean,
    val readyAt: String?,
    val approvedBy: String?,
    val approvedAt: String?,
    val rejectedBy: String?,
    val rejectedAt: String?,
    val rejectionReason: String?,
    val totalScans: Int,
    val createdAt: String,
    val updatedAt: String
)

enum class RackStatus {
    AVAILABLE, ASSIGNED, SCANNING, READY_FOR_APPROVAL, APPROVED, REJECTED
}

// domain/model/Scan.kt
data class Scan(
    val id: String,
    val barcode: String,
    val rackId: String,
    val auditSessionId: String,
    val scannerId: String,
    val deviceId: String?,
    val quantity: Int,
    val isRecount: Boolean,
    val recountOf: String?,
    val manualEntry: Boolean,
    val notes: String?,
    val createdAt: String
)
```

### 3.3 Database Layer (Room)

```kotlin
// data/local/entities/UserEntity.kt
@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
    val email: String,
    val fullName: String?,
    val role: String,
    val locationIds: String, // JSON string
    val deviceId: String?,
    val active: Boolean,
    val lastLogin: String?,
    val createdAt: String,
    val updatedAt: String
)

// data/local/dao/UserDao.kt
@Dao
interface UserDao {
    
    @Query("SELECT * FROM users WHERE id = :userId")
    suspend fun getUserById(userId: String): UserEntity?
    
    @Query("SELECT * FROM users WHERE email = :email")
    suspend fun getUserByEmail(email: String): UserEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserEntity)
    
    @Query("DELETE FROM users WHERE id = :userId")
    suspend fun deleteUser(userId: String)
    
    @Query("SELECT * FROM users")
    suspend fun getAllUsers(): List<UserEntity>
}

// Similar DAOs for LocationDao, RackDao, ScanDao, AuditSessionDao

// data/local/StockAuditDatabase.kt
@Database(
    entities = [
        UserEntity::class,
        LocationEntity::class,
        AuditSessionEntity::class,
        RackEntity::class,
        ScanEntity::class,
        SyncQueueEntity::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class StockAuditDatabase : RoomDatabase() {
    
    abstract fun userDao(): UserDao
    abstract fun locationDao(): LocationDao
    abstract fun auditSessionDao(): AuditSessionDao
    abstract fun rackDao(): RackDao
    abstract fun scanDao(): ScanDao
    abstract fun syncQueueDao(): SyncQueueDao
}

// data/local/Converters.kt
class Converters {
    
    @TypeConverter
    fun fromStringList(value: List<String>): String {
        return Gson().toJson(value)
    }
    
    @TypeConverter
    fun toStringList(value: String): List<String> {
        return Gson().fromJson(value, object : TypeToken<List<String>>() {}.type)
    }
    
    @TypeConverter
    fun fromIntList(value: List<Int>): String {
        return Gson().toJson(value)
    }
    
    @TypeConverter
    fun toIntList(value: String): List<Int> {
        return Gson().fromJson(value, object : TypeToken<List<Int>>() {}.type)
    }
}
```

---

## 4. UI/UX Implementation

### 4.1 MainActivity with Navigation

```kotlin
// ui/MainActivity.kt
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private lateinit var navController: NavController
    private val authViewModel: AuthViewModel by viewModels()
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        setupNavigation()
        observeAuthState()
        handleUsbIntent()
    }
    
    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController
        
        binding.bottomNavigation.setupWithNavController(navController)
    }
    
    private fun observeAuthState() {
        authViewModel.authState.observe(this) { authState ->
            when (authState) {
                is AuthState.Loading -> showLoading(true)
                is AuthState.Authenticated -> {
                    showLoading(false)
                    navigateToMain()
                }
                is AuthState.Unauthenticated -> {
                    showLoading(false)
                    navigateToAuth()
                }
                is AuthState.Error -> {
                    showLoading(false)
                    showError(authState.message)
                }
            }
        }
    }
    
    private fun handleUsbIntent() {
        if (intent.action == UsbManager.ACTION_USB_DEVICE_ATTACHED) {
            val device: UsbDevice? = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
            device?.let {
                // Handle USB scanner attachment
                // TODO: Implement USB scanner detection
            }
        }
    }
}
```

### 4.2 Scanning Screen Fragment

```kotlin
// ui/scanning/ScanningFragment.kt
@AndroidEntryPoint
class ScanningFragment : Fragment() {
    
    private var _binding: FragmentScanningBinding? = null
    private val binding get() = _binding!!
    
    private val scanningViewModel: ScanningViewModel by viewModels()
    private val args: ScanningFragmentArgs by navArgs()
    
    private lateinit var scanAdapter: ScanAdapter
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentScanningBinding.inflate(inflater, container, false)
        return binding.root
    }
    
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupRecyclerView()
        setupBarcodeScannerInput()
        observeViewModel()
        
        scanningViewModel.loadRackScans(args.rackId)
    }
    
    private fun setupRecyclerView() {
        scanAdapter = ScanAdapter(
            onDeleteScan = { scan -> scanningViewModel.deleteScan(scan.id) }
        )
        
        binding.recyclerViewScans.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = scanAdapter
            addItemDecoration(DividerItemDecoration(context, DividerItemDecoration.VERTICAL))
        }
    }
    
    private fun setupBarcodeScannerInput() {
        binding.editTextBarcode.apply {
            requestFocus()
            
            setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    val barcode = text.toString().trim()
                    if (barcode.isNotEmpty()) {
                        scanningViewModel.addScan(barcode, args.rackId)
                        text.clear()
                    }
                    true
                } else {
                    false
                }
            }
            
            // Handle USB scanner input (typically sends newline)
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
                override fun afterTextChanged(s: Editable?) {
                    s?.let { text ->
                        if (text.contains('\n') || text.contains('\r')) {
                            val barcode = text.toString().replace("[\n\r]".toRegex(), "").trim()
                            if (barcode.isNotEmpty()) {
                                scanningViewModel.addScan(barcode, args.rackId)
                                text.clear()
                            }
                        }
                    }
                }
            })
        }
        
        binding.buttonCameraScan.setOnClickListener {
            startCameraScanner()
        }
        
        binding.buttonMarkReady.setOnClickListener {
            scanningViewModel.markRackReady(args.rackId)
        }
    }
    
    private fun observeViewModel() {
        scanningViewModel.scans.observe(viewLifecycleOwner) { scans ->
            scanAdapter.submitList(scans)
            binding.textViewScanCount.text = "Scans: ${scans.size}"
        }
        
        scanningViewModel.uiState.observe(viewLifecycleOwner) { uiState ->
            binding.progressBar.isVisible = uiState.isLoading
            
            uiState.error?.let { error ->
                Snackbar.make(binding.root, error, Snackbar.LENGTH_LONG).show()
                scanningViewModel.clearError()
            }
            
            uiState.successMessage?.let { message ->
                Snackbar.make(binding.root, message, Snackbar.LENGTH_SHORT).show()
                scanningViewModel.clearSuccess()
            }
        }
    }
    
    private fun startCameraScanner() {
        val integrator = IntentIntegrator.forSupportFragment(this)
        integrator.setDesiredBarcodeFormats(IntentIntegrator.ALL_CODE_TYPES)
        integrator.setPrompt("Scan a barcode")
        integrator.setCameraId(0)
        integrator.setBeepEnabled(true)
        integrator.setBarcodeImageEnabled(true)
        integrator.initiateScan()
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null) {
            if (result.contents == null) {
                Toast.makeText(context, "Cancelled", Toast.LENGTH_LONG).show()
            } else {
                scanningViewModel.addScan(result.contents, args.rackId)
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```

### 4.3 ViewModels with Clean Architecture

```kotlin
// ui/scanning/ScanningViewModel.kt
@HiltViewModel
class ScanningViewModel @Inject constructor(
    private val scanRepository: ScanRepository,
    private val rackRepository: RackRepository,
    private val syncRepository: SyncRepository
) : ViewModel() {
    
    private val _scans = MutableLiveData<List<Scan>>()
    val scans: LiveData<List<Scan>> = _scans
    
    private val _uiState = MutableLiveData<UiState>()
    val uiState: LiveData<UiState> = _uiState
    
    fun loadRackScans(rackId: String) {
        viewModelScope.launch {
            try {
                _uiState.value = UiState(isLoading = true)
                scanRepository.getRackScans(rackId).collect { scanList ->
                    _scans.value = scanList
                    _uiState.value = UiState(isLoading = false)
                }
            } catch (e: Exception) {
                _uiState.value = UiState(isLoading = false, error = e.message)
            }
        }
    }
    
    fun addScan(barcode: String, rackId: String) {
        viewModelScope.launch {
            try {
                val scan = Scan(
                    id = UUID.randomUUID().toString(),
                    barcode = barcode,
                    rackId = rackId,
                    auditSessionId = getCurrentAuditSessionId(),
                    scannerId = getCurrentUserId(),
                    deviceId = getDeviceId(),
                    quantity = 1,
                    isRecount = false,
                    recountOf = null,
                    manualEntry = false,
                    notes = null,
                    createdAt = System.currentTimeMillis().toString()
                )
                
                scanRepository.addScan(scan)
                _uiState.value = UiState(successMessage = "Scan added: $barcode")
                
                // Vibrate for feedback
                vibrateDevice()
                
            } catch (e: Exception) {
                _uiState.value = UiState(error = e.message ?: "Failed to add scan")
            }
        }
    }
    
    fun deleteScan(scanId: String) {
        viewModelScope.launch {
            try {
                scanRepository.deleteScan(scanId)
                _uiState.value = UiState(successMessage = "Scan deleted")
            } catch (e: Exception) {
                _uiState.value = UiState(error = e.message ?: "Failed to delete scan")
            }
        }
    }
    
    fun markRackReady(rackId: String) {
        viewModelScope.launch {
            try {
                rackRepository.markRackReady(rackId)
                _uiState.value = UiState(successMessage = "Rack marked as ready for approval")
            } catch (e: Exception) {
                _uiState.value = UiState(error = e.message ?: "Failed to mark rack ready")
            }
        }
    }
    
    fun clearError() {
        _uiState.value = _uiState.value?.copy(error = null)
    }
    
    fun clearSuccess() {
        _uiState.value = _uiState.value?.copy(successMessage = null)
    }
    
    private suspend fun getCurrentAuditSessionId(): String {
        // Get from user preferences or repository
        return "current-session-id"
    }
    
    private suspend fun getCurrentUserId(): String {
        // Get from auth repository
        return "current-user-id"
    }
    
    private fun getDeviceId(): String {
        return android.provider.Settings.Secure.getString(
            getApplication<Application>().contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )
    }
    
    private fun vibrateDevice() {
        val vibrator = getApplication<Application>().getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(100, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(100)
            }
        }
    }
    
    data class UiState(
        val isLoading: Boolean = false,
        val error: String? = null,
        val successMessage: String? = null
    )
}
```

---

## 5. Data Management

### 5.1 Repository Pattern Implementation

```kotlin
// domain/repository/ScanRepository.kt
interface ScanRepository {
    suspend fun addScan(scan: Scan)
    suspend fun deleteScan(scanId: String)
    suspend fun getRackScans(rackId: String): Flow<List<Scan>>
    suspend fun getAllScans(): Flow<List<Scan>>
    suspend fun syncScans(): Result<Unit>
}

// data/repository/ScanRepositoryImpl.kt
@Singleton
class ScanRepositoryImpl @Inject constructor(
    private val scanDao: ScanDao,
    private val apiService: StockAuditApiService,
    private val syncQueueDao: SyncQueueDao,
    private val networkStateManager: NetworkStateManager
) : ScanRepository {
    
    override suspend fun addScan(scan: Scan) {
        // Save to local database first
        scanDao.insertScan(scan.toEntity())
        
        // Add to sync queue if online
        if (networkStateManager.isOnline()) {
            try {
                apiService.addScan(scan.toApiModel())
            } catch (e: Exception) {
                // If API call fails, add to sync queue
                syncQueueDao.insertSyncItem(
                    SyncQueueEntity(
                        id = UUID.randomUUID().toString(),
                        dataType = "scan",
                        action = "create",
                        itemId = scan.id,
                        data = Gson().toJson(scan),
                        createdAt = System.currentTimeMillis()
                    )
                )
            }
        } else {
            // Add to sync queue for later
            syncQueueDao.insertSyncItem(
                SyncQueueEntity(
                    id = UUID.randomUUID().toString(),
                    dataType = "scan",
                    action = "create", 
                    itemId = scan.id,
                    data = Gson().toJson(scan),
                    createdAt = System.currentTimeMillis()
                )
            )
        }
    }
    
    override suspend fun deleteScan(scanId: String) {
        scanDao.deleteScan(scanId)
        
        // Add delete action to sync queue
        syncQueueDao.insertSyncItem(
            SyncQueueEntity(
                id = UUID.randomUUID().toString(),
                dataType = "scan",
                action = "delete",
                itemId = scanId,
                data = null,
                createdAt = System.currentTimeMillis()
            )
        )
    }
    
    override suspend fun getRackScans(rackId: String): Flow<List<Scan>> {
        return scanDao.getRackScans(rackId).map { entities ->
            entities.map { it.toDomain() }
        }
    }
    
    override suspend fun getAllScans(): Flow<List<Scan>> {
        return scanDao.getAllScans().map { entities ->
            entities.map { it.toDomain() }
        }
    }
    
    override suspend fun syncScans(): Result<Unit> {
        return try {
            val pendingItems = syncQueueDao.getPendingSyncItems("scan")
            
            pendingItems.forEach { syncItem ->
                when (syncItem.action) {
                    "create" -> {
                        val scan = Gson().fromJson(syncItem.data, Scan::class.java)
                        apiService.addScan(scan.toApiModel())
                    }
                    "update" -> {
                        val scan = Gson().fromJson(syncItem.data, Scan::class.java)
                        apiService.updateScan(scan.id, scan.toApiModel())
                    }
                    "delete" -> {
                        apiService.deleteScan(syncItem.itemId)
                    }
                }
                
                // Mark as synced
                syncQueueDao.deleteSyncItem(syncItem.id)
            }
            
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
```

### 5.2 Network Layer (Retrofit)

```kotlin
// data/remote/StockAuditApiService.kt
interface StockAuditApiService {
    
    @POST("auth/login")
    suspend fun login(@Body loginRequest: LoginRequest): Response<LoginResponse>
    
    @GET("locations")
    suspend fun getLocations(): Response<List<LocationApiModel>>
    
    @GET("audit-sessions/{locationId}/active")
    suspend fun getActiveAuditSession(@Path("locationId") locationId: Int): Response<AuditSessionApiModel>
    
    @GET("racks")
    suspend fun getRacks(@Query("auditSessionId") auditSessionId: String): Response<List<RackApiModel>>
    
    @POST("scans")
    suspend fun addScan(@Body scan: ScanApiModel): Response<ScanApiModel>
    
    @PUT("scans/{id}")
    suspend fun updateScan(@Path("id") id: String, @Body scan: ScanApiModel): Response<ScanApiModel>
    
    @DELETE("scans/{id}")
    suspend fun deleteScan(@Path("id") id: String): Response<Unit>
    
    @PUT("racks/{id}/ready")
    suspend fun markRackReady(@Path("id") rackId: String): Response<RackApiModel>
    
    @GET("scans")
    suspend fun getRackScans(@Query("rackId") rackId: String): Response<List<ScanApiModel>>
}

// data/remote/interceptor/AuthInterceptor.kt
@Singleton
class AuthInterceptor @Inject constructor(
    private val authTokenManager: AuthTokenManager
) : Interceptor {
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        
        val token = authTokenManager.getAccessToken()
        
        val authenticatedRequest = if (token != null) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            originalRequest
        }
        
        return chain.proceed(authenticatedRequest)
    }
}
```

---

## 6. Authentication & Authorization

### 6.1 Authentication Manager

```kotlin
// data/auth/AuthManager.kt
@Singleton
class AuthManager @Inject constructor(
    private val apiService: StockAuditApiService,
    private val authTokenManager: AuthTokenManager,
    private val userPreferences: UserPreferences
) {
    
    private val _authState = MutableLiveData<AuthState>()
    val authState: LiveData<AuthState> = _authState
    
    suspend fun loginWithEmail(email: String): Result<Unit> {
        return try {
            _authState.postValue(AuthState.Loading)
            
            val response = apiService.requestEmailOtp(EmailOtpRequest(email))
            if (response.isSuccessful) {
                _authState.postValue(AuthState.OtpSent(email))
                Result.success(Unit)
            } else {
                _authState.postValue(AuthState.Error("Failed to send OTP"))
                Result.failure(Exception("Failed to send OTP"))
            }
        } catch (e: Exception) {
            _authState.postValue(AuthState.Error(e.message ?: "Unknown error"))
            Result.failure(e)
        }
    }
    
    suspend fun verifyOtp(email: String, otp: String): Result<Unit> {
        return try {
            _authState.postValue(AuthState.Loading)
            
            val response = apiService.verifyEmailOtp(EmailOtpVerifyRequest(email, otp))
            if (response.isSuccessful) {
                val authResponse = response.body()!!
                
                // Store tokens
                authTokenManager.saveTokens(
                    accessToken = authResponse.accessToken,
                    refreshToken = authResponse.refreshToken
                )
                
                // Store user data
                userPreferences.saveUser(authResponse.user)
                
                _authState.postValue(AuthState.Authenticated(authResponse.user))
                Result.success(Unit)
            } else {
                _authState.postValue(AuthState.Error("Invalid OTP"))
                Result.failure(Exception("Invalid OTP"))
            }
        } catch (e: Exception) {
            _authState.postValue(AuthState.Error(e.message ?: "Unknown error"))
            Result.failure(e)
        }
    }
    
    suspend fun loginWithGoogle(idToken: String): Result<Unit> {
        return try {
            _authState.postValue(AuthState.Loading)
            
            val response = apiService.loginWithGoogle(GoogleLoginRequest(idToken))
            if (response.isSuccessful) {
                val authResponse = response.body()!!
                
                authTokenManager.saveTokens(
                    accessToken = authResponse.accessToken,
                    refreshToken = authResponse.refreshToken
                )
                
                userPreferences.saveUser(authResponse.user)
                
                _authState.postValue(AuthState.Authenticated(authResponse.user))
                Result.success(Unit)
            } else {
                _authState.postValue(AuthState.Error("Google login failed"))
                Result.failure(Exception("Google login failed"))
            }
        } catch (e: Exception) {
            _authState.postValue(AuthState.Error(e.message ?: "Unknown error"))
            Result.failure(e)
        }
    }
    
    suspend fun logout() {
        authTokenManager.clearTokens()
        userPreferences.clearUser()
        _authState.postValue(AuthState.Unauthenticated)
    }
    
    suspend fun refreshToken(): Result<Unit> {
        return try {
            val refreshToken = authTokenManager.getRefreshToken()
            if (refreshToken != null) {
                val response = apiService.refreshToken(RefreshTokenRequest(refreshToken))
                if (response.isSuccessful) {
                    val authResponse = response.body()!!
                    authTokenManager.saveTokens(
                        accessToken = authResponse.accessToken,
                        refreshToken = authResponse.refreshToken
                    )
                    Result.success(Unit)
                } else {
                    logout()
                    Result.failure(Exception("Token refresh failed"))
                }
            } else {
                logout()
                Result.failure(Exception("No refresh token available"))
            }
        } catch (e: Exception) {
            logout()
            Result.failure(e)
        }
    }
    
    fun checkAuthState() {
        val user = userPreferences.getUser()
        val accessToken = authTokenManager.getAccessToken()
        
        if (user != null && accessToken != null) {
            _authState.value = AuthState.Authenticated(user)
        } else {
            _authState.value = AuthState.Unauthenticated
        }
    }
}

sealed class AuthState {
    object Loading : AuthState()
    object Unauthenticated : AuthState()
    data class OtpSent(val email: String) : AuthState()
    data class Authenticated(val user: User) : AuthState()
    data class Error(val message: String) : AuthState()
}
```

---

## 7. Offline Sync Strategy

### 7.1 Sync Manager

```kotlin
// data/sync/SyncManager.kt
@Singleton
class SyncManager @Inject constructor(
    private val syncQueueDao: SyncQueueDao,
    private val scanRepository: ScanRepository,
    private val rackRepository: RackRepository,
    private val networkStateManager: NetworkStateManager,
    private val workManager: WorkManager
) {
    
    private val _syncState = MutableStateFlow(SyncState.Idle)
    val syncState: StateFlow<SyncState> = _syncState.asStateFlow()
    
    suspend fun performSync() {
        if (!networkStateManager.isOnline()) {
            _syncState.value = SyncState.Error("No internet connection")
            return
        }
        
        try {
            _syncState.value = SyncState.Syncing
            
            // Sync in order of priority
            syncScans()
            syncRacks()
            syncAuditSessions()
            
            _syncState.value = SyncState.Success
        } catch (e: Exception) {
            _syncState.value = SyncState.Error(e.message ?: "Sync failed")
        }
    }
    
    private suspend fun syncScans() {
        val result = scanRepository.syncScans()
        if (result.isFailure) {
            throw result.exceptionOrNull() ?: Exception("Scan sync failed")
        }
    }
    
    private suspend fun syncRacks() {
        val result = rackRepository.syncRacks()
        if (result.isFailure) {
            throw result.exceptionOrNull() ?: Exception("Rack sync failed")
        }
    }
    
    private suspend fun syncAuditSessions() {
        // Implementation for audit session sync
    }
    
    fun schedulePendingSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.LINEAR,
                OneTimeWorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .build()
        
        workManager.enqueue(syncRequest)
    }
    
    suspend fun getPendingSyncCount(): Int {
        return syncQueueDao.getPendingSyncItemCount()
    }
}

sealed class SyncState {
    object Idle : SyncState()
    object Syncing : SyncState()
    object Success : SyncState()
    data class Error(val message: String) : SyncState()
}

// workers/SyncWorker.kt
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val syncManager: SyncManager
) : CoroutineWorker(context, workerParams) {
    
    override suspend fun doWork(): Result {
        return try {
            syncManager.performSync()
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
    
    @AssistedFactory
    interface Factory {
        fun create(context: Context, params: WorkerParameters): SyncWorker
    }
}
```

### 7.2 Network State Manager

```kotlin
// data/network/NetworkStateManager.kt
@Singleton
class NetworkStateManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    
    private val _networkState = MutableStateFlow(false)
    val networkState: StateFlow<Boolean> = _networkState.asStateFlow()
    
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            _networkState.value = true
        }
        
        override fun onLost(network: Network) {
            _networkState.value = false
        }
    }
    
    fun startMonitoring() {
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()
        
        connectivityManager.registerNetworkCallback(networkRequest, networkCallback)
        
        // Set initial state
        _networkState.value = isOnline()
    }
    
    fun stopMonitoring() {
        connectivityManager.unregisterNetworkCallback(networkCallback)
    }
    
    fun isOnline(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val networkCapabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        
        return networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
```

---

## 8. Real-time Updates

### 8.1 WebSocket Manager

```kotlin
// data/websocket/WebSocketManager.kt
@Singleton
class WebSocketManager @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val authTokenManager: AuthTokenManager
) {
    
    private var webSocket: WebSocket? = null
    private val _connectionState = MutableStateFlow(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()
    
    private val _messages = MutableSharedFlow<WebSocketMessage>()
    val messages: SharedFlow<WebSocketMessage> = _messages.asSharedFlow()
    
    fun connect(url: String) {
        val token = authTokenManager.getAccessToken()
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .build()
        
        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                _connectionState.value = ConnectionState.Connected
                
                // Subscribe to relevant channels
                subscribeToChannel("racks-changes")
                subscribeToChannel("notifications")
            }
            
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val message = Gson().fromJson(text, WebSocketMessage::class.java)
                    _messages.tryEmit(message)
                } catch (e: Exception) {
                    Timber.e(e, "Failed to parse WebSocket message")
                }
            }
            
            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.Disconnecting
            }
            
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.Disconnected
            }
            
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connectionState.value = ConnectionState.Error(t.message ?: "Connection failed")
            }
        })
    }
    
    fun disconnect() {
        webSocket?.close(1000, "User disconnect")
        webSocket = null
    }
    
    private fun subscribeToChannel(channel: String) {
        val subscribeMessage = mapOf(
            "event" => "phx_join",
            "topic" => channel,
            "payload" => emptyMap<String, Any>(),
            "ref" => System.currentTimeMillis().toString()
        )
        
        webSocket?.send(Gson().toJson(subscribeMessage))
    }
    
    fun sendMessage(message: Any) {
        val json = Gson().toJson(message)
        webSocket?.send(json)
    }
}

data class WebSocketMessage(
    val event: String,
    val topic: String,
    val payload: JsonObject,
    val ref: String?
)

sealed class ConnectionState {
    object Connecting : ConnectionState()
    object Connected : ConnectionState()
    object Disconnecting : ConnectionState()
    object Disconnected : ConnectionState()
    data class Error(val message: String) : ConnectionState()
}
```

### 8.2 Real-time Event Handler

```kotlin
// data/realtime/RealtimeEventHandler.kt
@Singleton
class RealtimeEventHandler @Inject constructor(
    private val rackRepository: RackRepository,
    private val notificationRepository: NotificationRepository,
    private val webSocketManager: WebSocketManager
) {
    
    fun startListening() {
        webSocketManager.messages
            .onEach { message ->
                handleMessage(message)
            }
            .launchIn(CoroutineScope(Dispatchers.IO))
    }
    
    private suspend fun handleMessage(message: WebSocketMessage) {
        when (message.topic) {
            "racks-changes" -> handleRackUpdate(message)
            "notifications" -> handleNotification(message)
        }
    }
    
    private suspend fun handleRackUpdate(message: WebSocketMessage) {
        try {
            when (message.event) {
                "UPDATE" -> {
                    val rackData = message.payload.getAsJsonObject("new")
                    val rack = Gson().fromJson(rackData, Rack::class.java)
                    rackRepository.updateRackFromRemote(rack)
                }
                "INSERT" -> {
                    val rackData = message.payload.getAsJsonObject("new")
                    val rack = Gson().fromJson(rackData, Rack::class.java)
                    rackRepository.addRackFromRemote(rack)
                }
                "DELETE" -> {
                    val rackData = message.payload.getAsJsonObject("old")
                    val rackId = rackData.get("id").asString
                    rackRepository.deleteRackFromRemote(rackId)
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to handle rack update")
        }
    }
    
    private suspend fun handleNotification(message: WebSocketMessage) {
        try {
            val notificationData = message.payload.getAsJsonObject("new")
            val notification = Gson().fromJson(notificationData, Notification::class.java)
            notificationRepository.addNotification(notification)
            
            // Show system notification if app is in background
            showSystemNotification(notification)
        } catch (e: Exception) {
            Timber.e(e, "Failed to handle notification")
        }
    }
    
    private fun showSystemNotification(notification: Notification) {
        // Implementation for system notifications
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        val builder = NotificationCompat.Builder(context, "stock_audit_channel")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(notification.title)
            .setContentText(notification.message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
        
        notificationManager.notify(notification.id.hashCode(), builder.build())
    }
}
```

---

## 9. USB Barcode Scanner Integration

### 9.1 USB Scanner Manager

```kotlin
// hardware/usb/UsbScannerManager.kt
@Singleton
class UsbScannerManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager
    private val _scannerState = MutableStateFlow<ScannerState>(ScannerState.Disconnected)
    val scannerState: StateFlow<ScannerState> = _scannerState.asStateFlow()
    
    private val _scannedData = MutableSharedFlow<String>()
    val scannedData: SharedFlow<String> = _scannedData.asSharedFlow()
    
    private var currentDevice: UsbDevice? = null
    private var connection: UsbDeviceConnection? = null
    private var inputThread: Thread? = null
    
    private val usbReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> {
                    val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    device?.let { handleDeviceAttached(it) }
                }
                UsbManager.ACTION_USB_DEVICE_DETACHED -> {
                    val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    device?.let { handleDeviceDetached(it) }
                }
                ACTION_USB_PERMISSION -> {
                    val device = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        device?.let { connectToDevice(it) }
                    } else {
                        _scannerState.value = ScannerState.PermissionDenied
                    }
                }
            }
        }
    }
    
    fun startMonitoring() {
        val filter = IntentFilter().apply {
            addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED)
            addAction(UsbManager.ACTION_USB_DEVICE_DETACHED)
            addAction(ACTION_USB_PERMISSION)
        }
        context.registerReceiver(usbReceiver, filter)
        
        // Check for already connected devices
        checkForConnectedDevices()
    }
    
    fun stopMonitoring() {
        context.unregisterReceiver(usbReceiver)
        disconnect()
    }
    
    private fun checkForConnectedDevices() {
        val deviceList = usbManager.deviceList
        for (device in deviceList.values) {
            if (isScannerDevice(device)) {
                handleDeviceAttached(device)
                break
            }
        }
    }
    
    private fun isScannerDevice(device: UsbDevice): Boolean {
        // Check for common barcode scanner vendor/product IDs
        // This is a simplified check - you may need to add more device IDs
        return when {
            // Common HID keyboard class for USB scanners
            device.deviceClass == UsbConstants.USB_CLASS_HID -> true
            // Specific vendor IDs for known scanner manufacturers
            device.vendorId == 0x05E0 -> true  // Symbol/Zebra
            device.vendorId == 0x0C2E -> true  // Honeywell
            device.vendorId == 0x1234 -> true  // Generic scanner
            else -> false
        }
    }
    
    private fun handleDeviceAttached(device: UsbDevice) {
        if (!usbManager.hasPermission(device)) {
            requestPermission(device)
        } else {
            connectToDevice(device)
        }
    }
    
    private fun handleDeviceDetached(device: UsbDevice) {
        if (device == currentDevice) {
            disconnect()
        }
    }
    
    private fun requestPermission(device: UsbDevice) {
        val permissionIntent = PendingIntent.getBroadcast(
            context, 
            0, 
            Intent(ACTION_USB_PERMISSION),
            PendingIntent.FLAG_IMMUTABLE
        )
        usbManager.requestPermission(device, permissionIntent)
    }
    
    private fun connectToDevice(device: UsbDevice) {
        try {
            currentDevice = device
            connection = usbManager.openDevice(device)
            
            if (connection != null) {
                _scannerState.value = ScannerState.Connected(device.deviceName)
                startReadingData()
            } else {
                _scannerState.value = ScannerState.Error("Failed to open device connection")
            }
        } catch (e: Exception) {
            _scannerState.value = ScannerState.Error(e.message ?: "Connection failed")
        }
    }
    
    private fun startReadingData() {
        inputThread = Thread {
            val buffer = ByteArray(1024)
            val inputStream = connection?.let { conn ->
                // For HID devices, we typically read from endpoint 0
                val intf = currentDevice?.getInterface(0)
                val endpoint = intf?.getEndpoint(0)
                
                if (endpoint != null && conn.claimInterface(intf, true)) {
                    endpoint
                } else null
            }
            
            while (!Thread.currentThread().isInterrupted && connection != null) {
                try {
                    inputStream?.let { endpoint ->
                        val bytesRead = connection!!.bulkTransfer(endpoint, buffer, buffer.size, 1000)
                        if (bytesRead > 0) {
                            val data = String(buffer, 0, bytesRead, Charsets.UTF_8).trim()
                            if (data.isNotEmpty()) {
                                _scannedData.tryEmit(data)
                            }
                        }
                    }
                } catch (e: Exception) {
                    Timber.e(e, "Error reading from USB device")
                    break
                }
            }
        }
        inputThread?.start()
    }
    
    fun disconnect() {
        inputThread?.interrupt()
        connection?.close()
        connection = null
        currentDevice = null
        _scannerState.value = ScannerState.Disconnected
    }
    
    companion object {
        private const val ACTION_USB_PERMISSION = "com.stockaudit.scanner.USB_PERMISSION"
    }
}

sealed class ScannerState {
    object Disconnected : ScannerState()
    data class Connected(val deviceName: String) : ScannerState()
    object PermissionDenied : ScannerState()
    data class Error(val message: String) : ScannerState()
}
```

### 9.2 USB Device Filter Configuration

Create `res/xml/device_filter.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- Generic HID devices (most USB scanners appear as HID keyboards) -->
    <usb-device class="3" subclass="1" protocol="1" />
    
    <!-- Specific vendor IDs for known barcode scanner manufacturers -->
    <!-- Symbol/Zebra scanners -->
    <usb-device vendor-id="1504" />
    
    <!-- Honeywell scanners -->
    <usb-device vendor-id="3118" />
    
    <!-- Datalogic scanners -->
    <usb-device vendor-id="1227" />
    
    <!-- Add more vendor IDs as needed -->
</resources>
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```kotlin
// test/java/ScanRepositoryTest.kt
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(MockitoJUnitRunner::class)
class ScanRepositoryTest {
    
    @Mock
    private lateinit var scanDao: ScanDao
    
    @Mock
    private lateinit var apiService: StockAuditApiService
    
    @Mock
    private lateinit var syncQueueDao: SyncQueueDao
    
    @Mock
    private lateinit var networkStateManager: NetworkStateManager
    
    private lateinit var repository: ScanRepositoryImpl
    
    private val testDispatcher = UnconfinedTestDispatcher()
    
    @Before
    fun setup() {
        repository = ScanRepositoryImpl(scanDao, apiService, syncQueueDao, networkStateManager)
    }
    
    @Test
    fun `addScan should save to local database and sync when online`() = runTest(testDispatcher) {
        // Given
        val scan = createTestScan()
        whenever(networkStateManager.isOnline()).thenReturn(true)
        whenever(apiService.addScan(any())).thenReturn(Response.success(scan.toApiModel()))
        
        // When
        repository.addScan(scan)
        
        // Then
        verify(scanDao).insertScan(scan.toEntity())
        verify(apiService).addScan(scan.toApiModel())
        verify(syncQueueDao, never()).insertSyncItem(any())
    }
    
    @Test
    fun `addScan should add to sync queue when offline`() = runTest(testDispatcher) {
        // Given
        val scan = createTestScan()
        whenever(networkStateManager.isOnline()).thenReturn(false)
        
        // When
        repository.addScan(scan)
        
        // Then
        verify(scanDao).insertScan(scan.toEntity())
        verify(apiService, never()).addScan(any())
        verify(syncQueueDao).insertSyncItem(any())
    }
    
    private fun createTestScan() = Scan(
        id = "test-id",
        barcode = "1234567890",
        rackId = "rack-id",
        auditSessionId = "session-id",
        scannerId = "scanner-id",
        deviceId = "device-id",
        quantity = 1,
        isRecount = false,
        recountOf = null,
        manualEntry = false,
        notes = null,
        createdAt = "2024-01-01T00:00:00Z"
    )
}
```

### 10.2 Integration Tests

```kotlin
// androidTest/java/ScanningIntegrationTest.kt
@RunWith(AndroidJUnit4::class)
@HiltAndroidTest
class ScanningIntegrationTest {
    
    @get:Rule
    var hiltRule = HiltAndroidRule(this)
    
    @get:Rule
    var activityRule = ActivityTestRule(MainActivity::class.java)
    
    @Before
    fun setup() {
        hiltRule.inject()
    }
    
    @Test
    fun scanBarcodeFlow() {
        // Navigate to scanning screen
        onView(withId(R.id.navigation_scanning)).perform(click())
        
        // Enter barcode
        onView(withId(R.id.editTextBarcode))
            .perform(typeText("1234567890"), pressImeActionButton())
        
        // Verify scan was added
        onView(withText("1234567890")).check(matches(isDisplayed()))
        
        // Verify scan count updated
        onView(withId(R.id.textViewScanCount))
            .check(matches(withText(containsString("1"))))
    }
}
```

### 10.3 UI Tests with Espresso

```kotlin
// androidTest/java/ScanningScreenTest.kt
@RunWith(AndroidJUnit4::class)
class ScanningScreenTest {
    
    @get:Rule
    var activityRule = ActivityTestRule(MainActivity::class.java)
    
    @Test
    fun testBarcodeInput() {
        // Navigate to scanning screen
        onView(withId(R.id.bottomNavigation))
            .perform(NavigationViewActions.navigateTo(R.id.navigation_scanning))
        
        // Test manual barcode entry
        onView(withId(R.id.editTextBarcode))
            .perform(typeText("1234567890"))
            .perform(pressImeActionButton())
        
        // Verify barcode appears in list
        onView(withText("1234567890"))
            .check(matches(isDisplayed()))
        
        // Test camera scanner button
        onView(withId(R.id.buttonCameraScan))
            .check(matches(isDisplayed()))
            .perform(click())
    }
    
    @Test
    fun testMarkRackReady() {
        // Add some scans first
        addTestScans()
        
        // Mark rack ready
        onView(withId(R.id.buttonMarkReady))
            .perform(click())
        
        // Verify confirmation dialog
        onView(withText("Mark rack ready for approval?"))
            .check(matches(isDisplayed()))
        
        onView(withText("OK"))
            .perform(click())
        
        // Verify success message
        onView(withText("Rack marked as ready for approval"))
            .check(matches(isDisplayed()))
    }
    
    private fun addTestScans() {
        val barcodes = listOf("111111", "222222", "333333")
        
        barcodes.forEach { barcode ->
            onView(withId(R.id.editTextBarcode))
                .perform(clearText(), typeText(barcode), pressImeActionButton())
        }
    }
}
```

---

## 11. Deployment & Distribution

### 11.1 Build Configuration

```gradle
// app/build.gradle
android {
    compileSdk 34
    
    defaultConfig {
        applicationId "com.stockaudit.scanner"
        minSdk 26
        targetSdk 34
        versionCode 1
        versionName "1.0.0"
        
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        
        buildConfigField "String", "SUPABASE_URL", "\"${project.findProperty('SUPABASE_URL') ?: ''}\""
        buildConfigField "String", "SUPABASE_ANON_KEY", "\"${project.findProperty('SUPABASE_ANON_KEY') ?: ''}\""
    }
    
    buildTypes {
        debug {
            isDebuggable = true
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            buildConfigField "boolean", "DEBUG_MODE", "true"
        }
        
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField "boolean", "DEBUG_MODE", "false"
            
            signingConfig = signingConfigs.getByName("release")
        }
    }
    
    signingConfigs {
        create("release") {
            storeFile = file("../keystores/release.keystore")
            storePassword = project.findProperty("RELEASE_STORE_PASSWORD") as String? ?: ""
            keyAlias = project.findProperty("RELEASE_KEY_ALIAS") as String? ?: ""
            keyPassword = project.findProperty("RELEASE_KEY_PASSWORD") as String? ?: ""
        }
    }
    
    flavorDimensions += "environment"
    productFlavors {
        create("production") {
            dimension = "environment"
            buildConfigField "String", "API_BASE_URL", "\"https://api.stockaudit.com\""
            buildConfigField "String", "WEBSOCKET_URL", "\"wss://api.stockaudit.com/websocket\""
        }
        
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            buildConfigField "String", "API_BASE_URL", "\"https://staging-api.stockaudit.com\""
            buildConfigField "String", "WEBSOCKET_URL", "\"wss://staging-api.stockaudit.com/websocket\""
        }
    }
}
```

### 11.2 Keystore Generation

```bash
# Generate release keystore
keytool -genkey -v -keystore release.keystore -alias stockaudit-release -keyalg RSA -keysize 2048 -validity 10000

# Add to gradle.properties (local file, not committed)
RELEASE_STORE_PASSWORD=your_store_password
RELEASE_KEY_PASSWORD=your_key_password
RELEASE_KEY_ALIAS=stockaudit-release
```

### 11.3 Firebase App Distribution Setup

```gradle
// app/build.gradle
apply plugin: 'com.google.firebase.appdistribution'

firebaseAppDistribution {
    releaseNotes = "Stock Audit Scanner v${defaultConfig.versionName}"
    groups = "internal-testers, qa-team"
    serviceCredentialsFile = "firebase-service-account.json"
}
```

### 11.4 Automated Build & Distribution

```yaml
# .github/workflows/android-deploy.yml
name: Android Build and Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 11
      uses: actions/setup-java@v3
      with:
        java-version: '11'
        distribution: 'temurin'
    
    - name: Setup Android SDK
      uses: android-actions/setup-android@v2
    
    - name: Cache Gradle packages
      uses: actions/cache@v3
      with:
        path: |
          ~/.gradle/caches
          ~/.gradle/wrapper
        key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
        restore-keys: |
          ${{ runner.os }}-gradle-
    
    - name: Create local.properties
      run: |
        echo "SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> local.properties
        echo "SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}" >> local.properties
    
    - name: Run tests
      run: ./gradlew test
    
    - name: Build debug APK
      if: github.ref != 'refs/heads/main'
      run: ./gradlew assembleDebug
    
    - name: Build release APK
      if: github.ref == 'refs/heads/main'
      run: ./gradlew assembleRelease
      env:
        RELEASE_STORE_PASSWORD: ${{ secrets.RELEASE_STORE_PASSWORD }}
        RELEASE_KEY_PASSWORD: ${{ secrets.RELEASE_KEY_PASSWORD }}
        RELEASE_KEY_ALIAS: ${{ secrets.RELEASE_KEY_ALIAS }}
    
    - name: Upload to Firebase App Distribution
      if: github.ref == 'refs/heads/main'
      run: ./gradlew appDistributionUploadRelease
      env:
        GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
    
    - name: Upload APK artifact
      uses: actions/upload-artifact@v3
      with:
        name: app-apk
        path: app/build/outputs/apk/**/*.apk
```

### 11.5 Play Store Deployment

```bash
# 1. Build release APK
./gradlew assembleRelease

# 2. Generate App Bundle (preferred for Play Store)
./gradlew bundleRelease

# 3. Upload to Play Console
# Use Google Play Console or fastlane for automated uploads

# fastlane setup (optional)
gem install fastlane

# Fastfile configuration
cd fastlane
cat > Fastfile << EOF
default_platform(:android)

platform :android do
  desc "Deploy to Play Store internal testing"
  lane :internal do
    gradle(task: "clean bundleRelease")
    upload_to_play_store(
      track: 'internal',
      aab: '../app/build/outputs/bundle/release/app-release.aab'
    )
  end
  
  desc "Deploy to Play Store production"
  lane :production do
    gradle(task: "clean bundleRelease")
    upload_to_play_store(
      track: 'production',
      aab: '../app/build/outputs/bundle/release/app-release.aab'
    )
  end
end
EOF
```

---

## 12. Common Issues & Solutions

### 12.1 USB Scanner Issues

**Problem**: USB scanner not detected
```kotlin
// Solution: Check USB permissions and device filters
private fun checkUsbPermissions() {
    val deviceList = usbManager.deviceList
    if (deviceList.isEmpty()) {
        showError("No USB devices detected. Check USB OTG adapter.")
        return
    }
    
    val scannerDevices = deviceList.values.filter { isScannerDevice(it) }
    if (scannerDevices.isEmpty()) {
        showError("No barcode scanners detected. Check device compatibility.")
        return
    }
    
    scannerDevices.forEach { device ->
        if (!usbManager.hasPermission(device)) {
            requestPermission(device)
        }
    }
}
```

**Problem**: Scanner input not working
```kotlin
// Solution: Handle different input methods
class BarcodeInputManager {
    private val inputBuffer = StringBuilder()
    private var lastInputTime = 0L
    private val INPUT_TIMEOUT = 100L // milliseconds
    
    fun handleKeyInput(keyEvent: KeyEvent): Boolean {
        val currentTime = System.currentTimeMillis()
        
        // Clear buffer if too much time passed (manual typing)
        if (currentTime - lastInputTime > INPUT_TIMEOUT) {
            inputBuffer.clear()
        }
        
        when (keyEvent.keyCode) {
            KeyEvent.KEYCODE_ENTER -> {
                val barcode = inputBuffer.toString().trim()
                if (barcode.isNotEmpty()) {
                    onBarcodeScanned(barcode)
                    inputBuffer.clear()
                }
                return true
            }
            else -> {
                if (keyEvent.action == KeyEvent.ACTION_DOWN) {
                    val char = keyEvent.unicodeChar
                    if (char != 0) {
                        inputBuffer.append(char.toChar())
                    }
                }
            }
        }
        
        lastInputTime = currentTime
        return false
    }
}
```

### 12.2 Database Issues

**Problem**: Room database migration failures
```kotlin
// Solution: Proper migration strategy
@Database(
    entities = [/*...*/],
    version = 2,
    exportSchema = true
)
abstract class StockAuditDatabase : RoomDatabase() {
    
    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(database: SupportSQLiteDatabase) {
                // Add new column
                database.execSQL("ALTER TABLE scans ADD COLUMN sync_status TEXT DEFAULT 'pending'")
                
                // Create new table
                database.execSQL("""
                    CREATE TABLE IF NOT EXISTS sync_queue (
                        id TEXT PRIMARY KEY NOT NULL,
                        data_type TEXT NOT NULL,
                        action TEXT NOT NULL,
                        item_id TEXT NOT NULL,
                        data TEXT,
                        created_at INTEGER NOT NULL
                    )
                """.trimIndent())
            }
        }
    }
}
```

**Problem**: SQLite lock errors
```kotlin
// Solution: Proper transaction handling
@Dao
interface ScanDao {
    @Transaction
    suspend fun addScanWithRackUpdate(scan: ScanEntity, rackId: String) {
        insertScan(scan)
        updateRackScanCount(rackId)
    }
    
    @Query("UPDATE racks SET total_scans = total_scans + 1 WHERE id = :rackId")
    suspend fun updateRackScanCount(rackId: String)
}
```

### 12.3 Network & Sync Issues

**Problem**: Slow sync performance
```kotlin
// Solution: Batch operations
class OptimizedSyncManager {
    private val BATCH_SIZE = 50
    
    suspend fun syncPendingScans() {
        val pendingScans = syncQueueDao.getPendingSyncItems("scan")
        
        pendingScans.chunked(BATCH_SIZE).forEach { batch ->
            try {
                val batchRequest = batch.map { syncItem ->
                    Gson().fromJson(syncItem.data, Scan::class.java).toApiModel()
                }
                
                apiService.batchAddScans(batchRequest)
                
                // Mark all as synced
                batch.forEach { syncQueueDao.deleteSyncItem(it.id) }
                
            } catch (e: Exception) {
                Timber.e(e, "Batch sync failed")
                // Individual retry logic here
            }
        }
    }
}
```

**Problem**: Connection timeout issues
```kotlin
// Solution: Proper timeout configuration
@Provides
@Singleton
fun provideOkHttpClient(): OkHttpClient {
    return OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .addInterceptor(HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        })
        .build()
}
```

### 12.4 Performance Issues

**Problem**: RecyclerView lag with large datasets
```kotlin
// Solution: DiffUtil and ViewHolder optimization
class ScanAdapter : ListAdapter<Scan, ScanViewHolder>(ScanDiffCallback()) {
    
    class ScanDiffCallback : DiffUtil.ItemCallback<Scan>() {
        override fun areItemsTheSame(oldItem: Scan, newItem: Scan): Boolean {
            return oldItem.id == newItem.id
        }
        
        override fun areContentsTheSame(oldItem: Scan, newItem: Scan): Boolean {
            return oldItem == newItem
        }
    }
    
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ScanViewHolder {
        val binding = ItemScanBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ScanViewHolder(binding)
    }
    
    override fun onBindViewHolder(holder: ScanViewHolder, position: Int) {
        holder.bind(getItem(position))
    }
}

class ScanViewHolder(private val binding: ItemScanBinding) : RecyclerView.ViewHolder(binding.root) {
    fun bind(scan: Scan) {
        binding.apply {
            textBarcode.text = scan.barcode
            textQuantity.text = scan.quantity.toString()
            textTimestamp.text = formatTime(scan.createdAt)
            
            // Optimize image loading if needed
            if (scan.isRecount) {
                iconRecount.visibility = View.VISIBLE
            } else {
                iconRecount.visibility = View.GONE
            }
        }
    }
}
```

### 12.5 Background Processing Issues

**Problem**: Background sync not working on some devices
```kotlin
// Solution: Handle battery optimization and background restrictions
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncManager: SyncManager
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        return try {
            // Set foreground service for long-running sync
            setForeground(createForegroundInfo())
            
            syncManager.performSync()
            Result.success()
            
        } catch (e: Exception) {
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
    
    private fun createForegroundInfo(): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, SYNC_CHANNEL_ID)
            .setContentTitle("Syncing data...")
            .setSmallIcon(R.drawable.ic_sync)
            .setOngoing(true)
            .build()
        
        return ForegroundInfo(SYNC_NOTIFICATION_ID, notification)
    }
    
    companion object {
        private const val SYNC_CHANNEL_ID = "sync_channel"
        private const val SYNC_NOTIFICATION_ID = 1001
    }
}
```

---

## 13. Migration Checklist

### 13.1 Pre-Migration Phase
- [ ] **Analysis Complete**: All React Native screens and components mapped
- [ ] **Data Models Defined**: Kotlin data classes created for all entities
- [ ] **Database Schema**: Room entities match existing SQLite schema
- [ ] **API Contracts**: Retrofit interfaces match Supabase API endpoints
- [ ] **Dependencies**: All required Android libraries added to build.gradle

### 13.2 Implementation Phase
- [ ] **Project Setup**: Android Studio project created with correct package structure
- [ ] **Architecture**: MVVM + Clean Architecture implemented
- [ ] **Database**: Room database with all DAOs implemented
- [ ] **Network Layer**: Retrofit service with proper error handling
- [ ] **Authentication**: Google OAuth and email OTP flows working
- [ ] **Core Screens**: All main UI screens implemented and functional
- [ ] **Barcode Scanning**: Both USB and camera scanning working
- [ ] **Offline Sync**: Background sync with queue management
- [ ] **Real-time Updates**: WebSocket integration for live updates

### 13.3 Testing Phase
- [ ] **Unit Tests**: Repository and ViewModel tests written
- [ ] **Integration Tests**: Database and API integration verified
- [ ] **UI Tests**: Critical user flows automated with Espresso
- [ ] **Manual Testing**: Full app tested on multiple devices
- [ ] **USB Scanner Testing**: Verified with actual hardware scanners
- [ ] **Offline Testing**: Sync behavior tested without internet
- [ ] **Performance Testing**: App performs well with large datasets

### 13.4 Deployment Phase
- [ ] **Build Configuration**: Release builds and signing configured
- [ ] **Firebase Distribution**: Internal testing setup working
- [ ] **Play Console**: App listing and metadata prepared
- [ ] **CI/CD Pipeline**: Automated builds and deployments working
- [ ] **Monitoring**: Crash reporting and analytics configured
- [ ] **Documentation**: User guides and technical docs updated

### 13.5 Post-Migration Phase
- [ ] **User Training**: Staff trained on any UI/UX differences
- [ ] **Data Migration**: Existing audit data migrated if needed
- [ ] **Performance Monitoring**: App performance tracked in production
- [ ] **Feedback Collection**: User feedback collected and addressed
- [ ] **Maintenance Plan**: Update and support schedule established

---

## Conclusion

This comprehensive guide provides a complete roadmap for migrating from React Native to native Android. The native implementation will offer:

**✅ Benefits Achieved:**
- Faster, more reliable build process
- Better USB scanner integration
- Improved offline performance
- Native Android UI/UX patterns
- Easier debugging and maintenance
- Better battery optimization
- More predictable behavior

**⚠️ Trade-offs:**
- Single platform (Android only)
- Larger initial development effort
- Platform-specific knowledge required
- No hot reload (but faster rebuilds)

**🕒 Estimated Timeline:**
- **Week 1**: Project setup, database, and core architecture
- **Week 2**: Authentication, scanning features, and UI implementation  
- **Week 3**: Sync, real-time updates, and USB integration
- **Week 4**: Testing, deployment setup, and production preparation

The native Android approach will provide a more stable, performant, and maintainable solution for your production stock audit system, avoiding the complex toolchain issues encountered with React Native.