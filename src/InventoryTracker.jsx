/* global __firebase_config, __initial_auth_token, __app_id */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
// IMPORTANT: Import browserLocalPersistence for persistence setting
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, doc, addDoc, serverTimestamp, setDoc, getDocs, where } from 'firebase/firestore';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, Cell } from 'recharts';
import { Download, ShoppingCart, TrendingUp, DollarSign, Plus } from 'lucide-react';

// --- Global Constants and Firebase Setup ---

// !!! IMPORTANT !!!
// When running the application locally, you must replace the placeholder values below 
// with the actual configuration details from YOUR Firebase project.
const localFirebaseConfig = {
  apiKey: "AIzaSyAUpKh17YNDSZNJCOkIJATAk3CclHm_CNI", 
  authDomain: "business-inventory-syste-14340.firebaseapp.com",
  projectId: "business-inventory-syste-14340", 
  storageBucket: "business-inventory-syste-14340.firebasestorage.app",
  messagingSenderId: "522961393427",
  appId: "1:522961393427:web:360da6317ca06c7b93ace6"
};

// Determine the configuration source: use the injected global variable if available, 
// otherwise fall back to the local config for local development.
const firebaseConfig = 
  typeof __firebase_config !== 'undefined' && __firebase_config !== null
    ? JSON.parse(__firebase_config) 
    : localFirebaseConfig;

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dress-business-app';

// Business Specific Constants
const PEOPLE = ['Subhasree', 'Keshav', 'Radha'];
const INITIAL_PRODUCT_TYPES = ['Tops', 'Colored Gown', 'White Gown', 'Lehenga', 'Saree', 'Jumpsuit', 'Blouse'];
const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];
const PAYMENT_MODES = ['Cash', 'Online Payment', 'Card'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']; // Tailwind-friendly colors

// --- Utility Functions ---

// Helper function to get the Firestore collection path
const getCollectionPath = (userId, collectionName) => 
  `/artifacts/${appId}/users/${userId}/${collectionName}`;

// Helper function to export data to CSV
const exportToCsv = (data, filename) => {
  if (!data || data.length === 0) return;

  const replacer = (key, value) => (value === null ? '' : value);
  const header = Object.keys(data[0]);
  
  // Format data for nested size objects and handles the updated stock fields
  const csv = [
    // Header Row
    header.map(h => {
        if (h === 'stockCounts') return SIZES.map(s => `Stock Count (${s})`).join(',');
        // Skip overallTotalCost in the header if it's the last element and already covered by the map
        return h;
    }).join(','),
    // Data Rows
    ...data.map(row => header.map(fieldName => {
      let value = row[fieldName];
      if (fieldName === 'stockCounts' && typeof value === 'object' && value !== null) {
        // Flatten the size counts into CSV columns
        return SIZES.map(s => value[s] || 0).join(',');
      }
      return JSON.stringify(value, replacer);
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  link.click();
};

// --- Main Application Component ---

const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [stocks, setStocks] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('stock'); // 'stock', 'sale', 'trends'

  // State for dynamically managing and expanding product types
  const [productTypes, setProductTypes] = useState(INITIAL_PRODUCT_TYPES); 

  // --- 1. Firebase Initialization and Authentication (FIXED FOR PERSISTENCE) ---
  useEffect(() => {
    try {
      if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
        console.error("Firebase config not available or incomplete. Please check localFirebaseConfig.");
        return; 
      }
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      
      setDb(firestore);
      setAuth(firebaseAuth);

      // Ensure persistence is set to LOCAL to persist across browser restarts
      setPersistence(firebaseAuth, browserLocalPersistence)
        .then(() => {
          console.log("Firebase Auth Persistence set to LOCAL.");
        })
        .catch((error) => {
          console.error("Error setting persistence:", error);
        });
      

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          // User is signed in (either from a previous anonymous session or custom token)
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          // No user is currently signed in. Attempt to sign in.
          try {
            if (initialAuthToken) {
              // 1. Use custom token if provided (e.g., deployed environment)
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              // 2. Fallback to anonymous sign-in.
              // Firebase's persistence will reuse the existing anonymous user if found in storage.
              await signInAnonymously(firebaseAuth);
            }
          } catch (e) {
            console.error("Error during initial sign-in:", e);
          }
        }
      });

      return () => unsubscribe(); // Cleanup the listener
      
    } catch (e) {
      console.error("Firebase Initialization Failed:", e);
    }
  }, []); // Empty dependency array means this runs only once on mount

  // --- 2. Real-time Data Fetching (Stocks and Sales) ---
  useEffect(() => {
    // Only run if Firebase is initialized and authentication is ready
    if (!db || !isAuthReady || !userId) return; 

    setLoading(true);

    const stockPath = getCollectionPath(userId, 'inventory_stocks');
    const salesPath = getCollectionPath(userId, 'inventory_sales');

    // Listener for Stocks
    const unsubscribeStocks = onSnapshot(collection(db, stockPath), (snapshot) => {
      const stockData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to JS Date
        dateOfPurchase: doc.data().dateOfPurchase?.toDate()?.toISOString().substring(0, 10) || '',
      }));
      setStocks(stockData.sort((a, b) => new Date(b.dateOfPurchase) - new Date(a.dateOfPurchase)));
      
      // Update productTypes state based on fetched data
      const existingTypes = new Set(INITIAL_PRODUCT_TYPES);
      stockData.forEach(s => existingTypes.add(s.productType));
      setProductTypes(Array.from(existingTypes));

      setLoading(false);
    }, (error) => console.error("Error fetching stocks:", error));

    // Listener for Sales
    const unsubscribeSales = onSnapshot(collection(db, salesPath), (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Convert Firestore timestamp to JS Date
        dateOfSale: doc.data().dateOfSale?.toDate()?.toISOString().substring(0, 10) || '',
      }));
      setSales(salesData.sort((a, b) => new Date(b.dateOfSale) - new Date(a.dateOfSale)));
      setLoading(false);
    }, (error) => console.error("Error fetching sales:", error));

    return () => {
      unsubscribeStocks();
      unsubscribeSales();
    };
  }, [db, userId, isAuthReady]);

  // --- 3. Stock Update Form Logic ---
  const StockForm = ({ onToggleView }) => {
    const [formData, setFormData] = useState({
      dateOfPurchase: new Date().toISOString().substring(0, 10),
      purchasedBy: PEOPLE[0],
      productType: productTypes[0] || INITIAL_PRODUCT_TYPES[0],
      costPerPiece: 0,
      // MODIFIED: now using Amount (₹) instead of Percentage (%)
      discountAmount: 0, 
      gstAmount: 0,
      // NEW: expense fields
      transportCost: 0, 
      stallRent: 0, 
      stockCounts: SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}),
      totalPurchaseAmount: 0, // Cost of Goods (Base + GST - Discount)
      overallTotalCost: 0,    // NEW: (Cost of Goods + Transport + Rent)
    });
    const [isSaving, setIsSaving] = useState(false);
    const [otherProductType, setOtherProductType] = useState(''); // For "Other" option

    const handleStockCountChange = (size, value) => {
      const count = Math.max(0, parseInt(value, 10) || 0);
      setFormData(prev => ({
        ...prev,
        stockCounts: { ...prev.stockCounts, [size]: count }
      }));
    };

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Calculate derived fields (Total Purchase Amount and Overall Total Cost)
    const calculateTotalCosts = useCallback(() => {
      const totalPieces = Object.values(formData.stockCounts).reduce((a, b) => a + b, 0);
      const baseCost = totalPieces * (parseFloat(formData.costPerPiece) || 0);

      // Financials (Parsed to float, defaulting to 0)
      const discount = parseFloat(formData.discountAmount) || 0;
      const gst = parseFloat(formData.gstAmount) || 0;
      const transport = parseFloat(formData.transportCost) || 0;
      const rent = parseFloat(formData.stallRent) || 0;

      // Total Purchase Amount (Cost of Goods = Base Cost + GST - Discount)
      const totalGoodsCost = baseCost + gst - discount;
      
      // Overall Total Cost (Includes operating expenses)
      const overallTotal = totalGoodsCost + transport + rent;
      
      return { 
        totalGoodsCost: Math.max(0, totalGoodsCost).toFixed(2), 
        overallTotalCost: Math.max(0, overallTotal).toFixed(2) 
      };
    }, [formData.stockCounts, formData.costPerPiece, formData.discountAmount, formData.gstAmount, formData.transportCost, formData.stallRent]);

    useEffect(() => {
      const { totalGoodsCost, overallTotalCost } = calculateTotalCosts();
      setFormData(prev => ({ 
          ...prev, 
          totalPurchaseAmount: totalGoodsCost, // Cost of Goods
          overallTotalCost: overallTotalCost    // Overall Expense
      }));
    }, [calculateTotalCosts]);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!db || !userId) return;

      const totalPieces = Object.values(formData.stockCounts).reduce((a, b) => a + b, 0);
      if (totalPieces === 0) {
        console.error("Total stock count must be greater than zero.");
        return;
      }
      
      setIsSaving(true);
      
      let finalProductType = formData.productType;
      // Handle "Other" product type logic
      if (formData.productType === 'Other') {
        if (!otherProductType.trim()) {
            console.error("Please enter a name for the new Product Type.");
            setIsSaving(false);
            return;
        }
        finalProductType = otherProductType.trim();
        // Update the global state if this is a truly new type
        if (!productTypes.includes(finalProductType)) {
            setProductTypes(prev => [...prev, finalProductType]);
        }
      }

      try {
        const docRef = collection(db, getCollectionPath(userId, 'inventory_stocks'));
        await addDoc(docRef, {
          ...formData,
          productType: finalProductType, // Use the final, resolved product type
          dateOfPurchase: new Date(formData.dateOfPurchase),
          // Ensure all financial fields are stored as numbers
          costPerPiece: parseFloat(formData.costPerPiece) || 0,
          discountAmount: parseFloat(formData.discountAmount) || 0,
          gstAmount: parseFloat(formData.gstAmount) || 0,
          transportCost: parseFloat(formData.transportCost) || 0,
          stallRent: parseFloat(formData.stallRent) || 0,
          totalPurchaseAmount: parseFloat(formData.totalPurchaseAmount) || 0,
          overallTotalCost: parseFloat(formData.overallTotalCost) || 0,
          timestamp: serverTimestamp(),
        });

        // Reset form for next entry
        setFormData({
          dateOfPurchase: new Date().toISOString().substring(0, 10),
          purchasedBy: PEOPLE[0],
          productType: productTypes.includes(finalProductType) ? finalProductType : productTypes[0], // Keep selected or revert
          costPerPiece: 0,
          discountAmount: 0,
          gstAmount: 0,
          transportCost: 0,
          stallRent: 0,
          stockCounts: SIZES.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}),
          totalPurchaseAmount: 0,
          overallTotalCost: 0,
        });
        setOtherProductType('');
        
      } catch (error) {
        console.error("Error adding stock:", error);
      } finally {
        setIsSaving(false);
      }
    };

    // Prepare options for the Select component, including 'Other'
    const productOptions = [...productTypes, 'Other'];

    return (
      <form onSubmit={handleSubmit} className="stock-form-container space-y-4">
        <h2 className="form-title">Stock Purchase Update</h2>
        
        {/* Row 1: Date & Purchased By */}
        <div className="grid-container">
          <Input name="dateOfPurchase" type="date" label="Date of Purchase" value={formData.dateOfPurchase} onChange={handleInputChange} required />
          <Select name="purchasedBy" label="Purchased By" value={formData.purchasedBy} onChange={handleInputChange} options={PEOPLE} />
        </div>

        {/* Row 2: Product Type & Cost per Piece */}
        <div className="grid-container">
          <Select name="productType" label="Product Type" value={formData.productType} onChange={handleInputChange} options={productOptions} />
          <Input name="costPerPiece" type="number" step="0.01" label="Cost per Piece (₹)" value={formData.costPerPiece} onChange={handleInputChange} required />
        </div>

        {/* Conditional Input for "Other" Product Type */}
        {formData.productType === 'Other' && (
            <Input 
                name="otherProductType" 
                type="text" 
                label="Enter New Product Type Name" 
                value={otherProductType} 
                onChange={(e) => setOtherProductType(e.target.value)} 
                required 
            />
        )}

        {/* Row 3: Discounts and GST (Amount) */}
        <div className="grid-container lg-grid-4"> 
            {/* Note: lg-grid-4 is a hypothetical class. Keeping inline for complex layout for now: grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 */}
          <Input name="discountAmount" type="number" step="0.01" label="Discount Amount (₹)" value={formData.discountAmount} onChange={handleInputChange} />
          <Input name="gstAmount" type="number" step="0.01" label="GST Amount (₹)" value={formData.gstAmount} onChange={handleInputChange} />
          <div className="lg-col-span-2"> 
            {/* Note: lg-col-span-2 is a hypothetical class. Keeping inline for complex layout for now: lg:col-span-2 */}
            <label className="input-label">Total Goods Cost (Subtotal)</label>
            <div className="cost-display cost-goods">
            {/* Custom class used for styling this cost box */}
              ₹ {formData.totalPurchaseAmount}
            </div>
            <p className="text-xs text-gray-500 mt-1">(Base Cost + GST - Discount)</p>
          </div>
        </div>
        
        {/* Row 4: New Expense Fields and Overall Total Cost */}
        <div className="grid-container border-t pt-4"> 
            {/* Note: Keeping inline border/padding classes for structure */}
          <Input name="transportCost" type="number" step="0.01" label="Transport Cost (₹)" value={formData.transportCost} onChange={handleInputChange} />
          <Input name="stallRent" type="number" step="0.01" label="Stall Rent (₹)" value={formData.stallRent} onChange={handleInputChange} />
          <div className="lg-col-span-2"> 
            {/* Note: lg-col-span-2 is a hypothetical class. Keeping inline for complex layout for now: lg:col-span-2 */}
            <label className="input-label">Overall Total Cost (Final)</label>
            <div className="cost-display cost-overall">
            {/* Custom class used for styling this cost box */}
              ₹ {formData.overallTotalCost}
            </div>
            <p className="text-xs text-gray-500 mt-1">(Goods Cost + Transport + Rent)</p>
          </div>
        </div>


        {/* Row 5: Stock Counts by Size */}
        <div className="border-t pt-4">
          <label className="input-label mb-2">Total Stock Count by Size</label>
          <div className="grid-container grid-sm-3 grid-lg-5"> 
            {/* Note: Using grid-container + some inline utility classes for size control */}
            {SIZES.map(size => (
              <Input
                key={size}
                label={size}
                type="number"
                min="0"
                value={formData.stockCounts[size] || 0}
                onChange={(e) => handleStockCountChange(size, e.target.value)}
                required
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onToggleView}
            className="button button-sale flex items-center" 
            // Used button-sale for the toggle button
          >
            <DollarSign className="w-5 h-5 mr-2" /> Go to Sales
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="button button-stock flex items-center disabled:opacity-50"
            // Used button-stock for the submit button
          >
            <Plus className="w-5 h-5 mr-2" /> {isSaving ? 'Saving...' : 'Add Stock Entry'}
          </button>
        </div>
      </form>
    );
  };

  // --- 4. Selling Update Form Logic (with Actual Price auto-fill) ---
  const SaleForm = ({ onToggleView }) => {
    const [formData, setFormData] = useState({
      dateOfSale: new Date().toISOString().substring(0, 10),
      soldBy: PEOPLE[0],
      productType: productTypes[0] || INITIAL_PRODUCT_TYPES[0], // Use state-managed types
      size: SIZES[0],
      soldFor: '',
      modeOfPayment: PAYMENT_MODES[0],
      paymentReceivedBy: PEOPLE[0],
    });
    const [isSaving, setIsSaving] = useState(false);

    // Find the 'Actual Price' (Cost per Piece) from the latest stock entry for the selected product/size
    const actualPrice = useMemo(() => {
      const relevantStock = stocks
        .filter(s => s.productType === formData.productType && (s.stockCounts[formData.size] > 0 || s.stockCounts[formData.size] === undefined) )
        .sort((a, b) => new Date(b.dateOfPurchase) - new Date(a.dateOfPurchase))[0]; // Get the latest one
      
      return (relevantStock?.costPerPiece || 0).toFixed(2);
    }, [formData.productType, formData.size, stocks]);

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!db || !userId) return;

      setIsSaving(true);
      try {
        const docRef = collection(db, getCollectionPath(userId, 'inventory_sales'));
        await addDoc(docRef, {
          ...formData,
          actualPrice: parseFloat(actualPrice) || 0, // Store the auto-filled actual price
          soldFor: parseFloat(formData.soldFor) || 0,
          dateOfSale: new Date(formData.dateOfSale), // Convert date string to Firestore Timestamp
          timestamp: serverTimestamp(),
        });
        
        // Reset form for next entry
        setFormData({
          dateOfSale: new Date().toISOString().substring(0, 10),
          soldBy: PEOPLE[0],
          productType: productTypes[0] || INITIAL_PRODUCT_TYPES[0],
          size: SIZES[0],
          soldFor: '',
          modeOfPayment: PAYMENT_MODES[0],
          paymentReceivedBy: PEOPLE[0],
        });

      } catch (error) {
        console.error("Error adding sale:", error);
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="sale-form-container space-y-4">
        <h2 className="form-title">Sale Transaction Update</h2>
        
        {/* Row 1: Date & Sold By */}
        <div className="grid-container">
          <Input name="dateOfSale" type="date" label="Date of Sale" value={formData.dateOfSale} onChange={handleInputChange} required />
          <Select name="soldBy" label="Sold By" value={formData.soldBy} onChange={handleInputChange} options={PEOPLE} />
        </div>

        {/* Row 2: Product Type & Size */}
        <div className="grid-container">
          <Select name="productType" label="Product Type" value={formData.productType} onChange={handleInputChange} options={productTypes} />
          <Select name="size" label="Size" value={formData.size} onChange={handleInputChange} options={SIZES} />
        </div>

        {/* Row 3: Pricing & Actual Price */}
        <div className="grid-container">
          <div>
            <label className="input-label">Actual Cost Price (Auto)</label>
            <div className="cost-display cost-actual">
              ₹ {actualPrice}
            </div>
            <p className="text-xs text-gray-500 mt-1">Sourced from latest stock entry for this product/size.</p>
          </div>
          <Input name="soldFor" type="number" step="0.01" label="Sold For (Selling Price)" value={formData.soldFor} onChange={handleInputChange} required />
        </div>

        {/* Row 4: Payment Details */}
        <div className="grid-container">
          <Select name="modeOfPayment" label="Mode of Payment" value={formData.modeOfPayment} onChange={handleInputChange} options={PAYMENT_MODES} />
          <Select name="paymentReceivedBy" label="Payment Received By" value={formData.paymentReceivedBy} onChange={handleInputChange} options={PEOPLE} />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onToggleView}
            className="button button-stock flex items-center" 
            // Used button-stock for the toggle button
          >
            <ShoppingCart className="w-5 h-5 mr-2" /> Go to Stock
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="button button-sale flex items-center disabled:opacity-50"
            // Used button-sale for the submit button
          >
            <DollarSign className="w-5 h-5 mr-2" /> {isSaving ? 'Saving...' : 'Record Sale'}
          </button>
        </div>
      </form>
    );
  };

  // --- 5. Trends & Visualization Component ---
  const TrendsView = () => {
    // Aggregation for Bar Chart (Sales by Person and Product)
    const salesByPersonAndType = useMemo(() => {
      const dataMap = {};
      sales.forEach(sale => {
        const key = `${sale.soldBy}-${sale.productType}`;
        const profit = (sale.soldFor || 0) - (sale.actualPrice || 0);

        if (!dataMap[key]) {
          dataMap[key] = { name: `${sale.soldBy} - ${sale.productType}`, count: 0, revenue: 0, profit: 0 };
        }
        dataMap[key].count++;
        dataMap[key].revenue += sale.soldFor || 0;
        dataMap[key].profit += profit;
      });
      return Object.values(dataMap);
    }, [sales]);

    // Aggregation for Pie Chart (Revenue by Payment Mode)
    const revenueByPaymentMode = useMemo(() => {
      const dataMap = {};
      sales.forEach(sale => {
        const mode = sale.modeOfPayment || 'Unknown';
        if (!dataMap[mode]) {
          dataMap[mode] = { name: mode, value: 0 };
        }
        dataMap[mode].value += sale.soldFor || 0;
      });
      return Object.values(dataMap).filter(d => d.value > 0);
    }, [sales]);
    
    // Aggregation for Financial Summary by Product Type (Total Revenue, Cost, Remaining Value)
    const financialSummaryByProduct = useMemo(() => {
        const consumedStockMap = {}; // Tracks sold stock count
        const initialStockMap = {};  // Tracks total initial stock and latest cost per item

        // 1. Calculate consumed stock
        sales.forEach(sale => {
            const key = `${sale.productType}-${sale.size}`;
            consumedStockMap[key] = (consumedStockMap[key] || 0) + 1;
        });

        // 2. Calculate initial stock and latest cost for remaining stock valuation
        stocks.forEach(stock => {
            SIZES.forEach(size => {
                const count = stock.stockCounts[size] || 0;
                if (count > 0) {
                    const key = `${stock.productType}-${size}`;
                    // Use the latest cost for valuation
                    initialStockMap[key] = {
                        productType: stock.productType,
                        size: size,
                        initialCount: (initialStockMap[key]?.initialCount || 0) + count,
                        latestCost: stock.costPerPiece,
                    };
                }
            });
        });

        // 3. Calculate metrics: Revenue, Cost of Goods Sold (COGS), Remaining Value
        const summary = {};
        
        // Process Sales (to get Revenue and COGS)
        sales.forEach(sale => {
            if (!summary[sale.productType]) {
                summary[sale.productType] = { name: sale.productType, totalRevenue: 0, totalGoodsCost: 0, remainingStockValue: 0 };
            }
            summary[sale.productType].totalRevenue += sale.soldFor || 0;
            summary[sale.productType].totalGoodsCost += sale.actualPrice || 0;
        });

        // Process Remaining Stock (Value)
        Object.values(initialStockMap).forEach(item => {
            const key = `${item.productType}-${item.size}`;
            const sold = consumedStockMap[key] || 0;
            const current = item.initialCount - sold;
            const value = Math.max(0, current) * item.latestCost; // Remaining value based on latest cost

            if (!summary[item.productType]) {
                summary[item.productType] = { name: item.productType, totalRevenue: 0, totalGoodsCost: 0, remainingStockValue: 0 };
            }
            summary[item.productType].remainingStockValue += value;
        });


      // Final mapping for chart
      return Object.values(summary).map(item => ({
        name: item.name,
        'Total Revenue (Sold)': item.totalRevenue,
        'Total Goods Cost': item.totalGoodsCost,
        'Remaining Stock Value': item.remainingStockValue || 0,
      }));

    }, [stocks, sales]);
    
    // NEW: Aggregation for Inventory Distribution (Stock Counts by Product Type and Size)
    const currentStockByProductAndSize = useMemo(() => {
        const consumedStockMap = {}; // Tracks sold stock count by key: product-size
        const summary = {}; // Tracks remaining stock count by product type, with keys for each size

        // 1. Calculate consumed stock
        sales.forEach(sale => {
            const key = `${sale.productType}-${sale.size}`;
            consumedStockMap[key] = (consumedStockMap[key] || 0) + 1;
        });

        // 2. Calculate initial stock and latest cost for remaining stock valuation
        stocks.forEach(stock => {
            SIZES.forEach(size => {
                const initialCount = stock.stockCounts[size] || 0;
                if (initialCount > 0) {
                    const productType = stock.productType;
                    const key = `${productType}-${size}`;
                    
                    if (!summary[productType]) {
                        summary[productType] = { name: productType };
                        SIZES.forEach(s => summary[productType][s] = 0); // Initialize size keys
                    }
                    
                    // Accumulate initial stock (in case of multiple purchases)
                    summary[productType][size] += initialCount; 
                }
            });
        });

        // 3. Subtract consumed stock to get final remaining count
        Object.keys(summary).forEach(productType => {
            SIZES.forEach(size => {
                const key = `${productType}-${size}`;
                const sold = consumedStockMap[key] || 0;
                summary[productType][size] = Math.max(0, summary[productType][size] - sold);
            });
        });

        return Object.values(summary).filter(item => 
            SIZES.some(size => item[size] > 0) // Only include products that still have stock
        );

    }, [stocks, sales]);


    if (loading) return <LoadingSpinner />;
    if (sales.length === 0 && stocks.length === 0) return (
      <div className="trends-empty-state">
        <TrendingUp className="icon-large icon-gray mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-600">No data yet. Enter Stock and Sale transactions to see trends.</p>
      </div>
    );

    return (
      <div className="space-y-8">
        <h2 className="title-2xl">Sales and Inventory Trends</h2>

        {/* NEW CHART: Inventory Distribution (X=Product Type, Y=Stock Count, Bars Stacked by Size) */}
        <Card title="Current Stock Distribution by Product Type and Size">
            <p className="text-sm text-gray-500 mb-4">
                This stacked chart shows the **Remaining Stock Count** for each product type, with bars broken down by size.
            </p>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={currentStockByProductAndSize} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" stroke="#6b7280" angle={-15} textAnchor="end" height={60} interval={0} style={{ fontSize: '10px' }} />
                    <YAxis stroke="#6b7280" label={{ value: 'Units of Stock', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value, name) => [value, `Size: ${name}`]} />
                    <Legend iconType="circle" />
                    
                    {/* Stacked Bars for each Size */}
                    {SIZES.map((size, index) => (
                        <Bar 
                            key={size} 
                            dataKey={size} 
                            stackId="a" 
                            fill={COLORS[index % COLORS.length]} 
                            name={`Size ${size}`}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </Card>
        
        {/* EXISTING CHART: Financial Overview by Product Type (Revenue, Cost, Value) */}
        <Card title="Financial Overview by Product Type (Revenue, Cost, Remaining Value)">
            <p className="text-sm text-gray-500 mb-4">Compares **Total Revenue**, **Total Goods Cost** (of sold items), and the calculated **Value of Stock Remaining** On Hand, grouped by Product Type.</p>
            <ResponsiveContainer width="100%" height={350}>
                <BarChart data={financialSummaryByProduct} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" stroke="#6b7280" angle={-15} textAnchor="end" height={60} interval={0} style={{ fontSize: '10px' }} />
                    <YAxis stroke="#6b7280" label={{ value: 'Amount (₹)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value, name) => [`₹ ${value.toFixed(2)}`, name]} />
                    <Legend iconType="circle" />
                    {/* Revenue - Green */}
                    <Bar dataKey="Total Revenue (Sold)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    {/* Cost - Red/Orange */}
                    <Bar dataKey="Total Goods Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    {/* Remaining Value - Blue */}
                    <Bar dataKey="Remaining Stock Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </Card>

        {/* 1. Bar Chart: Total Profit by Seller/Product (Existing Chart) */}
        <Card title="Profit by Seller and Product Type">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesByPersonAndType} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" stroke="#6b7280" angle={-15} textAnchor="end" height={50} interval={0} style={{ fontSize: '10px' }} />
              <YAxis stroke="#6b7280" label={{ value: 'Total Profit (₹)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value) => `₹ ${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="profit" name="Total Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* 2. Pie Chart: Revenue Distribution by Payment Mode */}
        <div className="grid-container lg-grid-2 gap-8">
          <Card title="Revenue by Payment Mode">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={revenueByPaymentMode}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {revenueByPaymentMode.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹ ${value.toFixed(2)}`} />
                <Legend layout="vertical" verticalAlign="bottom" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

      </div>
    );
  };

  // --- 6. Data Tables & Export ---
  const DataTables = () => {
    const isStocksEmpty = stocks.length === 0;
    const isSalesEmpty = sales.length === 0;

    return (
      <div className="space-y-8">
        <h2 className="title-2xl">Raw Data Records</h2>
        
        {/* Stock Data Table */}
        <Card title="Stock Purchase Records">
          <div className="flex justify-end mb-4">
            <button
              onClick={() => exportToCsv(stocks, 'stock_records.csv')}
              disabled={isStocksEmpty}
              className="button button-export flex items-center disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" /> Export Stock Data
            </button>
          </div>
          {isStocksEmpty ? (
            <EmptyState message="No stock purchase records found." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="table-head">
                  <tr>
                    <TableHeader>Date</TableHeader>
                    <TableHeader>By</TableHeader>
                    <TableHeader>Product</TableHeader>
                    <TableHeader>Cost/Piece (₹)</TableHeader>
                    <TableHeader>Transport (₹)</TableHeader>
                    <TableHeader>Rent (₹)</TableHeader>
                    {SIZES.map(s => <TableHeader key={s}>Stock ({s})</TableHeader>)}
                    <TableHeader>Overall Total (₹)</TableHeader>
                  </tr>
                </thead> </table>
                <tbody className="table-body">
                  {stocks.map(s => (
                    <tr key={s.id} className="table-row">
                      <TableData>{s.dateOfPurchase}</TableData>
                      <TableData>{s.purchasedBy}</TableData>
                      <TableData>{s.productType}</TableData>
                      <TableData className="text-green-700 font-medium">{s.costPerPiece?.toFixed(2)}</TableData>
                      <TableData>{s.transportCost?.toFixed(2) || '0.00'}</TableData>
                      <TableData>{s.stallRent?.toFixed(2) || '0.00'}</TableData>
                      {SIZES.map(size => <TableData key={size}>{s.stockCounts?.[size] || 0}</TableData>)}
                      <TableData className="text-red-700 font-semibold">{s.overallTotalCost?.toFixed(2) || s.totalPurchaseAmount?.toFixed(2) || '0.00'}</TableData>
                   </tr>
                  ))}
                 </tbody>
            </div>
          )}
        </Card>

        {/* Sale Data Table */}
        <Card title="Sale Transaction Records">
          <div className="flex justify-end mb-4">
            <button
              onClick={() => exportToCsv(sales, 'sale_records.csv')}
              disabled={isSalesEmpty}
              className="button button-export flex items-center disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" /> Export Sales Data
            </button>
          </div>
          {isSalesEmpty ? (
            <EmptyState message="No sale transaction records found." />
          ) : (
            <div className="table-container">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="table-head">
                  <tr>
                    <TableHeader>Date</TableHeader>
                    <TableHeader>Sold By</TableHeader>
                    <TableHeader>Product (Size)</TableHeader>
                    <TableHeader>Cost Price (₹)</TableHeader>
                    <TableHeader>Sold For (₹)</TableHeader>
                    <TableHeader>Profit (₹)</TableHeader>
                    <TableHeader>Payment</TableHeader>
                  </tr>
                </thead>
                <tbody className="table-body">
                  {sales.map(s => (
                    <tr key={s.id} className="table-row">
                      <TableData>{s.dateOfSale}</TableData>
                      <TableData>{s.soldBy}</TableData>
                      <TableData>{s.productType} ({s.size})</TableData>
                      <TableData>{s.actualPrice?.toFixed(2)}</TableData>
                      <TableData className="text-green-700 font-medium">{s.soldFor?.toFixed(2)}</TableData>
                      <TableData className={s.soldFor > s.actualPrice ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                        {(s.soldFor - s.actualPrice)?.toFixed(2)}
                      </TableData>
                      <TableData>{s.modeOfPayment}</TableData>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };


  // --- Helper Components ---
  const Input = ({ label, name, type = 'text', value, onChange, required = false, min, step }) => (
    <div>
      <label htmlFor={name} className="input-label">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        step={step}
        className="input-field"
      />
    </div>
  );

  const Select = ({ label, name, value, onChange, options, required = false }) => (
    <div>
      <label htmlFor={name} className="input-label">{label}</label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="select-field"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );

  const TabButton = ({ view, label, icon: Icon }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`tab-button ${currentView === view ? 'tab-button-active' : 'tab-button-inactive'} flex items-center`}
    >
      <Icon className="w-5 h-5 mr-2" />
      {label}
    </button>
  );

  const Card = ({ title, children }) => (
    <div className="card-container">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );

  const TableHeader = ({ children }) => (
    <th scope="col" className="table-header">
      {children}
    </th>
  );

  const TableData = ({ children, className = '' }) => (
    <td className={`table-data ${className}`}>
      {children}
    </td>
  );

  const LoadingSpinner = () => (
    <div className="loading-spinner-container">
      <div className="spinner"></div>
      <p className="ml-4 text-lg text-indigo-600">Loading data...</p>
    </div>
  );

  const EmptyState = ({ message }) => (
    <div className="empty-state">
      <p className="text-gray-500 font-medium">{message}</p>
    </div>
  );


  // --- Main Render ---
  return (
    <div className="app-container">
      <header className="header-container">
        <h1 className="title-h1">
          Dress Business Inventory System
        </h1>
        <p className="text-gray-600">
          Welcome, **User: {userId || 'Initializing...'}**. Manage your stock, sales, and track key trends.
        </p>
      </header>

      {/* Navigation Tabs */}
      <nav className="nav-tabs">
        <TabButton view="stock" label="Stock Entry" icon={ShoppingCart} />
        <TabButton view="sale" label="Sales Entry" icon={DollarSign} />
        <TabButton view="trends" label="Trends & Reports" icon={TrendingUp} />
        <TabButton view="data" label="Raw Data Export" icon={Download} />
      </nav>

      {/* Content Area */}
      <main className="main-content">
        {loading && (currentView !== 'data') ? (
            <LoadingSpinner />
        ) : (
            currentView === 'stock' ? (
              <StockForm onToggleView={() => setCurrentView('sale')} />
            ) : currentView === 'sale' ? (
              <SaleForm onToggleView={() => setCurrentView('stock')} />
            ) : currentView === 'trends' ? (
              <TrendsView />
            ) : (
              <DataTables />
            )
        )}
      </main>
      </div>
  );
};

export default App;