import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';

import { useColorScheme } from 'react-native';

import { useRef, useState } from 'react';
import { LineChart } from 'react-native-chart-kit';


export default function HomeScreen() {

  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const styles = createStyles(isDarkMode);

  // =========================
  // STATES
  // =========================

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Expense');

  // Category state
  const [category, setCategory] = useState('');

  // Category dropdown state
  const [showCategories, setShowCategories] = useState(false);

  //lets edit transactions
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  //fiter
  const [filter, setFilter] = useState('All');
 const [overviewPeriod, setOverviewPeriod] = useState('Day');

  const [transactions, setTransactions] = useState([
  {
    name: 'Food',
    amount: 150,
    type: 'Expense',
    category: 'Food',
    date: '2026-09-01',
    time: '08:00',
  },
  {
    name: 'Transportation',
    amount: 80,
    type: 'Expense',
    category: 'Transportation',
    date: '2026-09-02',
    time: '10:00',
  },
  {
    name: 'Allowance',
    amount: 1500,
    type: 'Income',
    category: 'Allowance',
    date: '2026-09-03',
    time: '12:00',
  },
  {
    name: 'Shopping',
    amount: 350,
    type: 'Expense',
    category: 'Shopping',
    date: '2026-09-03',
    time: '15:00',
  },
]);

const totalIncome = transactions
  .filter((transaction) => transaction.type === 'Income')
  .reduce((total, transaction) => total + transaction.amount, 0);

const totalExpenses = transactions
  .filter((transaction) => transaction.type === 'Expense')
  .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = totalIncome - totalExpenses;
  const totalTransactions = transactions.length;

const graphData = Object.values(
  transactions.reduce((acc, transaction) => {
    let key = transaction.date;

      if (overviewPeriod === 'Day') {
    const now = new Date();

      const today =
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(now.getDate()).padStart(2, '0');

    if (transaction.date !== today) {
      return acc;
    }

    key = transaction.time || '00:00';
  }

    if (overviewPeriod === 'Week') {
  key = transaction.date;
}

         if (overviewPeriod === 'Month') {
            const now = new Date();

            const currentMonth =
              now.getFullYear() +
              '-' +
              String(now.getMonth() + 1).padStart(2, '0');

            if (!transaction.date.startsWith(currentMonth)) {
              return acc;
            }

            key = transaction.date;
          }

    if (overviewPeriod === 'Year') {
      key = transaction.date.substring(0, 4);
    }

    if (!acc[key]) {
      acc[key] = {
        date: key,
        income: 0,
        expense: 0,
      };
    }

    if (transaction.type === 'Income') {
      acc[key].income += transaction.amount;
    } else {
      acc[key].expense += transaction.amount;
    }

    return acc;
  }, {} as Record<string, {
    date: string;
    income: number;
    expense: number;
  }>)
);

graphData.sort((a, b) => {
  if (overviewPeriod === 'Day') {
    return a.date.localeCompare(b.date);
  }

  return new Date(a.date).getTime() -
    new Date(b.date).getTime();
});

  const filteredTransactions = transactions.filter((transaction) => {
  if (filter === 'Income') {
    return transaction.type === 'Income';
  }

  if (filter === 'Expense') {
    return transaction.type === 'Expense';
  }

  return true;
});

  // =========================
  // CATEGORY LISTS
  // =========================

  const expenseCategories = [
    'Food',
    'Shopping',
    'Transportation',
    'Bills',
    'Entertainment',
    'Health',
    'Education',
    'Other',
  ];

  const incomeCategories = [
    'Salary',
    'Allowance',
    'Freelance',
    'Gift',
    'Other',
  ];

  const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Food':
      return '🍔';
    case 'Shopping':
      return '🛒';
    case 'Transportation':
      return '🚌';
    case 'Bills':
      return '💡';
    case 'Entertainment':
      return '🎮';
    case 'Health':
      return '💊';
    case 'Education':
      return '📚';
    case 'Salary':
      return '💰';
    case 'Allowance':
      return '💵';
    case 'Freelance':
      return '💻';
    case 'Gift':
      return '🎁';
    default:
      return '💳';
  }
};

    const deleteTransaction = (index: number) => {
      Alert.alert(
        'Delete Transaction',
        'Are you sure you want to delete this transaction?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const updatedTransactions = transactions.filter(
                (_, i) => i !== index
              );

              setTransactions(updatedTransactions);
            },
          },
        ]
      );
    };

  // =========================
  // AMOUNT FORMATTER
  // =========================

  const formatAmount = (value: string) => {

    // Remove everything except numbers and decimal point
    let cleaned = value.replace(/[^0-9.]/g, '');

    // Allow only one decimal point
    const parts = cleaned.split('.');

    let whole = parts[0] || '0';
    let decimal = parts[1] || '';

    // Limit decimal places to 2
    decimal = decimal.slice(0, 2);

    // Remove unnecessary leading zeros
    whole = whole.replace(/^0+(?=\d)/, '');

    // Add commas
    const formattedWhole = Number(whole || 0).toLocaleString('en-PH');

    // Always show 2 decimal places
    return `${formattedWhole}.${decimal.padEnd(2, '0')}`;
  };


  // =========================
  // FAB SETTINGS
  // =========================

  const { width, height } = Dimensions.get('window');

  const BUTTON_SIZE = 60;
  const MARGIN = 10;

  const pan = useRef(
  new Animated.ValueXY({
    x: width - BUTTON_SIZE - 25,
    y: height - BUTTON_SIZE - 150,
  })
).current;

 const startPosition = useRef({
  x: width - BUTTON_SIZE - 25,
  y: height - BUTTON_SIZE - 150,
}).current;


  // =========================
  // FAB DRAGGING
  // =========================

  const panResponder = useRef(
    PanResponder.create({

      onStartShouldSetPanResponder: () => true,

      onPanResponderMove: (_, gesture) => {

        let newX = startPosition.x + gesture.dx;
        let newY = startPosition.y + gesture.dy;

        // Keep button inside left/right edges
        newX = Math.max(
          MARGIN,
          Math.min(
            newX,
            width - BUTTON_SIZE - MARGIN
          )
        );

        // Keep button inside top/bottom edges
        newY = Math.max(
          MARGIN,
          Math.min(
            newY,
            height - BUTTON_SIZE - MARGIN
          )
        );

        pan.setValue({
          x: newX,
          y: newY,
        });
      },

      onPanResponderRelease: (_, gesture) => {

        startPosition.x += gesture.dx;
        startPosition.y += gesture.dy;

        // Keep saved position inside screen
        startPosition.x = Math.max(
          MARGIN,
          Math.min(
            startPosition.x,
            width - BUTTON_SIZE - MARGIN
          )
        );

        startPosition.y = Math.max(
          MARGIN,
          Math.min(
            startPosition.y,
            height - BUTTON_SIZE - MARGIN
          )
        );

        pan.setValue({
          x: startPosition.x,
          y: startPosition.y,
        });
      },
    })
  ).current;

  // =========================
  // MAIN SCREEN
  // =========================

  return (
    <View style={styles.container}>

      {/* ================================================= */}
      {/* DASHBOARD                                         */}
      {/* ================================================= */}

      {!showForm && (
  <ScrollView
    style={styles.dashboardContainer}
    contentContainerStyle={styles.dashboardContent}
    showsVerticalScrollIndicator={false}
  >
  
        

          <Text style={styles.title}>
            ExTrack
          </Text>

          <Text style={styles.subtitle}>
            Personal Finance Tracker
          </Text>


          {/* BALANCE CARD */}

          <View style={styles.balanceCard}>

            <Text style={styles.balanceLabel}>
              Available Balance
            </Text>

            <Text style={styles.balance}>
            ₱{balance.toLocaleString('en-PH', {
              minimumFractionDigits: 2,
            })}
          </Text>

          </View>


          {/* INCOME / EXPENSE */}

          <View style={styles.summary}>

  {/* INCOME */}
  <View style={styles.summaryBox}>
    <Text style={styles.label}>Income</Text>
    <Text style={styles.income}>
      ₱{totalIncome.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}
    </Text>
  </View>

  {/* EXPENSES */}
  <View style={styles.summaryBox}>
    <Text style={styles.label}>Expenses</Text>
    <Text style={styles.expense}>
      ₱{totalExpenses.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}
    </Text>
  </View>

  {/* BALANCE */}
  <View style={styles.summaryBox}>
    <Text style={styles.label}>Balance</Text>
    <Text style={styles.balanceSmall}>
      ₱{balance.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
      })}
    </Text>
  </View>

  {/* TRANSACTIONS */}
  <View style={styles.summaryBox}>
    <Text style={styles.label}>Transactions</Text>
    <Text style={styles.transactionCount}>
      {totalTransactions}
    </Text>
  </View>

</View>

        {/* FINANCIAL OVERVIEW */}

              <View style={styles.graphSection}>

  <Text style={styles.sectionTitle}>
    Financial Overview
  </Text>

  <View style={styles.overviewFilters}>
  {['Day', 'Week', 'Month', 'Year'].map((period) => (
    <TouchableOpacity
      key={period}
      style={[
        styles.overviewFilter,
        overviewPeriod === period && styles.selectedOverviewFilter,
      ]}
      onPress={() => setOverviewPeriod(period)}
    >
      <Text
        style={[
          styles.overviewFilterText,
          overviewPeriod === period &&
            styles.selectedOverviewFilterText,
        ]}
      >
        {period}
      </Text>
    </TouchableOpacity>
  ))}
</View>

  <View style={styles.graphCard}>

  <LineChart
    data={{
            labels: graphData.map((item) => {
        if (overviewPeriod === 'Day') {
  const [hour, minute] = item.date.split(':').map(Number);

  const displayHour =
    hour === 0
      ? 12
      : hour > 12
      ? hour - 12
      : hour;

  const period = hour >= 12 ? 'PM' : 'AM';

  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
} 

            if (overviewPeriod === 'Week') {
          const date = new Date(item.date);

          return date.toLocaleDateString('en-PH', {
            weekday: 'short',
          });
        }

        const date = new Date(item.date);

        if (overviewPeriod === 'Year') {
          return date.toLocaleDateString('en-PH', {
            year: 'numeric',
          });
        }

        if (overviewPeriod === 'Month') {
          return date.toLocaleDateString('en-PH', {
            day: 'numeric',
          });
        }

        return date.toLocaleDateString('en-PH', {
          month: 'short',
          day: 'numeric',
        });
      }),
      datasets: [
        {
          data: graphData.map((item) => item.income),
        },
        {
          data: graphData.map((item) => item.expense),
        },
      ],
    }}
    width={320}
    height={180}
    chartConfig={{
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      decimalPlaces: 0,
      color: (opacity = 1) =>
        `rgba(30, 58, 138, ${opacity})`,
      labelColor: (opacity = 1) =>
        `rgba(0, 0, 0, ${opacity})`,
      style: {
        borderRadius: 12,
      },
      propsForDots: {
        r: '4',
      },
    }}
    bezier
    style={styles.lineChart}
  />

  <View style={styles.graphLegend}>

  <View style={styles.legendItem}>
    <View style={styles.incomeDot} />
    <Text style={styles.legendText}>Income</Text>
  </View>

  <View style={styles.legendItem}>
    <View style={styles.expenseDot} />
    <Text style={styles.legendText}>Expenses</Text>
  </View>

</View>

</View>

</View> 
          {/* TRANSACTIONS HEADER */}

          <View style={styles.transactionHeader}>

  <Text style={styles.sectionTitle}>
    Recent Transactions
  </Text>

  <Text style={styles.amountHeader}>
    Amount
  </Text>

</View>

<View style={styles.filterContainer}>

  <TouchableOpacity
    style={[
      styles.filterButton,
      filter === 'All' && styles.selectedFilter,
    ]}
    onPress={() => setFilter('All')}
  >
    <Text
      style={[
        styles.filterText,
        filter === 'All' && styles.selectedFilterText,
      ]}
    >
      All
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.filterButton,
      filter === 'Income' && styles.selectedFilter,
    ]}
    onPress={() => setFilter('Income')}
  >
    <Text
      style={[
        styles.filterText,
        filter === 'Income' && styles.selectedFilterText,
      ]}
    >
      Income
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={[
      styles.filterButton,
      filter === 'Expense' && styles.selectedFilter,
    ]}
    onPress={() => setFilter('Expense')}
  >
    <Text
      style={[
        styles.filterText,
        filter === 'Expense' && styles.selectedFilterText,
      ]}
    >
      Expenses
    </Text>
  </TouchableOpacity>

    </View>


          {/* TRANSACTION 1 */}

       {filteredTransactions.length === 0 ? (
  <View style={styles.emptyTransactions}>
    <Text style={styles.emptyTransactionsText}>
      No transactions found.
    </Text>
  </View>
) : (
  filteredTransactions.map((transaction) => {
    const originalIndex = transactions.findIndex(
      (item) => item === transaction
    );

    return (
      <View
        style={styles.transaction}
        key={originalIndex}
      >
        <Text style={styles.transactionName}>
          {getCategoryIcon(transaction.category)} {transaction.name}
        </Text>

        <View style={styles.transactionRight}>

          <Text
            style={
              transaction.type === 'Income'
                ? styles.incomeAmount
                : styles.expenseAmount
            }
          >
            {transaction.type === 'Income' ? '+' : '-'}₱
            {transaction.amount.toLocaleString('en-PH', {
              minimumFractionDigits: 2,
            })}
          </Text>

          <TouchableOpacity
            onPress={() => {
              setEditingIndex(originalIndex);
              setName(transaction.name);
              setAmount(transaction.amount.toString());
              setType(transaction.type);
              setCategory(transaction.category);
              setShowForm(true);
            }}
          >
            <Text style={styles.editText}>✎</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => deleteTransaction(originalIndex)}
          >
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>

        </View>

      </View>
    );
  })
)}

          </ScrollView>
          
      )}
      
    
      {/* FLOATING BUTTON */}

        {!showForm && (
          <Animated.View
            style={[
              styles.fab,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              style={styles.fabTouchable}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.fabText}>
                +
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}


      {/* ================================================= */}
      {/* ADD TRANSACTION FORM                              */}
      {/* ================================================= */}

      {showForm && (

        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* HEADER */}

          <View style={styles.formHeader}>

            <TouchableOpacity
             onPress={() => {
              setShowForm(false);
              setShowCategories(false);
              setEditingIndex(null);
              setName('');
              setAmount('');
              setType('Expense');
              setCategory('');
            }}
            >

              <Text style={styles.backButton}>
                ‹
              </Text>

            </TouchableOpacity>


            <Text style={styles.formTitle}>
              {editingIndex !== null ? 'Edit Transaction' : 'Add Transaction'}
            </Text>

          </View>


          {/* TRANSACTION NAME */}

          <Text style={styles.inputLabel}>
            Transaction Name (Optional)
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter Transaction Name"
            keyboardType="default"
            value={name}
            onChangeText={setName}
          />


          {/* AMOUNT */}

          <Text style={styles.inputLabel}>
            Amount
          </Text>


          <View style={styles.amountInputContainer}>

            <Text style={styles.currencySymbol}>
              ₱
            </Text>

            <TextInput
              style={styles.amountInput}
              keyboardType="decimal-pad"
              value={amount}
              placeholder="0.00"
              placeholderTextColor="#999"
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');

                const parts = cleaned.split('.');
                const whole = parts[0] || '';
                const decimal = parts[1] || '';

                const formattedWhole = Number(whole || 0).toLocaleString('en-PH');

                const formatted = decimal
                  ? `${formattedWhole}.${decimal.slice(0, 2)}`
                  : formattedWhole;

                setAmount(formatted);
              }}
            />

          </View>


          {/* TYPE */}

          <Text style={styles.inputLabel}>
            Type
          </Text>


          <View style={styles.typeContainer}>

            {/* EXPENSE */}

            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'Expense' &&
                  styles.selectedType,
              ]}
              onPress={() => {

                setType('Expense');

                // Reset category when type changes
                setCategory('');

              }}
            >

              <Text
                style={[
                  styles.typeText,
                  type === 'Expense' &&
                    styles.selectedTypeText,
                ]}
              >
                Expense
              </Text>

            </TouchableOpacity>


            {/* INCOME */}

            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'Income' &&
                  styles.selectedType,
              ]}
              onPress={() => {

                setType('Income');

                // Reset category when type changes
                setCategory('');

              }}
            >

              <Text
                style={[
                  styles.typeText,
                  type === 'Income' &&
                    styles.selectedTypeText,
                ]}
              >
                Income
              </Text>

            </TouchableOpacity>

          </View>


          {/* CATEGORY */}

          <Text style={styles.label}>
            Category
          </Text>


          <TouchableOpacity
            style={styles.categoryButton}
            onPress={() =>
              setShowCategories(!showCategories)
            }
          >

            <Text style={styles.categoryText}>

              {category || 'Select Category'}

            </Text>


            <Text style={styles.arrow}>

              {showCategories
                ? '▲'
                : '▼'}

            </Text>

          </TouchableOpacity>


          {/* CATEGORY DROPDOWN */}

          {showCategories && (

            <View style={styles.categoryList}>

              <ScrollView
                style={styles.categoryScroll}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >

                {(type === 'Expense'
                  ? expenseCategories
                  : incomeCategories
                ).map((cat) => (

                  <TouchableOpacity
                    key={cat}
                    style={styles.categoryItem}
                    onPress={() => {

                      setCategory(cat);
                      setShowCategories(false);

                    }}
                  >

                    <Text
                      style={
                        styles.categoryItemText
                      }
                    >
                      {cat}
                    </Text>

                  </TouchableOpacity>

                ))}

              </ScrollView>

            </View>

          )}


          {/* SAVE BUTTON */}

          <TouchableOpacity
              style={styles.saveButton}
              onPress={() => {
              if (!amount || Number(amount.replace(/,/g, '')) <= 0) {
                alert('Please enter a valid amount.');
                return;
              }

              if (!category) {
                alert('Please select a category.');
                return;
              }

                const now = new Date();

              const updatedTransaction = {
                name: name || category || 'Unnamed Transaction',
                amount: Number(amount.replace(/,/g, '')),
                type: type,
                category: category,
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().slice(0, 5),
              };

              if (editingIndex !== null) {
                const updatedTransactions = [...transactions];

                updatedTransactions[editingIndex] = updatedTransaction;

                setTransactions(updatedTransactions);
              } else {
                setTransactions([
                  updatedTransaction,
                  ...transactions,
                ]);
              }

              setName('');
              setAmount('');
              setType('Expense');
              setCategory('');
              setEditingIndex(null);
              setShowCategories(false);
              setShowForm(false);
            }}
            >
              <Text style={styles.saveButtonText}>
                {editingIndex !== null ? 'UPDATE TRANSACTION' : 'SAVE TRANSACTION'}
              </Text>
          </TouchableOpacity>


        </ScrollView>
        
        

      )}
    </View>
  );
}


// =====================================================
// STYLES
// =====================================================

const createStyles = (isDarkMode: boolean) => {
  const backgroundColor = isDarkMode ? '#121212' : '#f5f5f5';
  const cardColor = isDarkMode ? '#1e1e1e' : 'white';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const secondaryTextColor = isDarkMode ? '#aaaaaa' : 'gray';
  const borderColor = isDarkMode ? '#333333' : '#dddddd';
  const lightBorderColor = isDarkMode ? '#333333' : '#eeeeee';

  return StyleSheet.create({

    // =========================
    // MAIN CONTAINER
    // =========================

    container: {
      flex: 1,
      backgroundColor: backgroundColor,
    },

    graphSection: {
      marginBottom: 20,
    },

    transactionCount: {
      color: '#60a5fa',
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 5,
      textAlign: 'center',
    },

    emptyTransactions: {
      backgroundColor: cardColor,
      padding: 25,
      borderRadius: 12,
      alignItems: 'center',
    },

    emptyTransactionsText: {
      color: secondaryTextColor,
      fontSize: 15,
    },

    transactionRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    dashboardContainer: {
      flex: 1,
      backgroundColor: backgroundColor,
    },

    dashboardContent: {
      padding: 25,
      paddingTop: 60,
      paddingBottom: 120,
    },

   filterContainer: {
  flexDirection: 'row',
  marginBottom: 18,
  gap: 8,
},

filterButton: {
  backgroundColor: cardColor,
  paddingVertical: 7,
  paddingHorizontal: 16,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: borderColor,
},

    selectedFilter: {
      backgroundColor: '#1e3a8a',
    },

    filterText: {
      fontSize: 14,
      fontWeight: '600',
      color: textColor,
    },

    selectedFilterText: {
      color: 'white',
    },

    // =========================
    // DASHBOARD
    // =========================

    title: {
      fontSize: 32,
      fontWeight: 'bold',
      color: textColor,
    },

    subtitle: {
      fontSize: 16,
      color: secondaryTextColor,
      marginBottom: 20,
    },

    balanceCard: {
      backgroundColor: '#1e3a8a',
      padding: 20,
      borderRadius: 18,
      marginBottom: 20,
    },

    balanceLabel: {
      color: 'white',
      fontSize: 16,
    },

    balance: {
      color: 'white',
      fontSize: 30,
      fontWeight: 'bold',
      marginTop: 8,
    },

    // =========================
    // SUMMARY
    // =========================

    summary: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 22,
    },

      summaryBox: {
        width: '48%',
        backgroundColor: cardColor,
        padding: 15,
        borderRadius: 12,
        minHeight: 85,
        justifyContent: 'center',
      },

    balanceSmall: {
      color: '#60a5fa',
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 5,
    },

    income: {
      color: '#22c55e',
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 5,
    },

    expense: {
      color: '#ef4444',
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 5,
    },

    // =========================
    // TRANSACTIONS
    // =========================

    transactionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: textColor,
    },

    amountHeader: {
      fontSize: 14,
      color: secondaryTextColor,
      fontWeight: '600',
    },

  transaction: {
  backgroundColor: cardColor,
  paddingVertical: 15,
  paddingHorizontal: 16,
  borderRadius: 12,
  marginBottom: 10,
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

    transactionName: {
  fontSize: 15,
  flex: 1,
  color: textColor,
},

    expenseAmount: {
      fontSize: 15,
      fontWeight: '600',
      color: '#ef4444',
      minWidth: 95,
      textAlign: 'right',
    },

    incomeAmount: {
      fontSize: 15,
      fontWeight: '600',
      color: '#22c55e',
      minWidth: 95,
      textAlign: 'right',
    },

    // =========================
    // FLOATING ACTION BUTTON
    // =========================

    fab: {
      position: 'absolute',
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#1e3a8a',
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 5,
      zIndex: 999,
    },

    fabText: {
      color: 'white',
      fontSize: 32,
      fontWeight: '300',
      lineHeight: 34,
    },

    fabTouchable: {
      width: 60,
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // =========================
    // ADD TRANSACTION
    // =========================

    formContainer: {
      flex: 1,
      backgroundColor: backgroundColor,
      padding: 25,
      paddingTop: 60,
    },

    contentContainer: {
      paddingBottom: 50,
    },

    formHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 35,
    },

    backButton: {
      fontSize: 40,
      marginRight: 15,
      color: textColor,
    },

    formTitle: {
      fontSize: 25,
      fontWeight: 'bold',
      color: textColor,
    },

    // =========================
    // INPUTS
    // =========================

    inputLabel: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 15,
      color: textColor,
    },

    input: {
      backgroundColor: cardColor,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: textColor,
    },

    // =========================
    // AMOUNT
    // =========================

    amountInputContainer: {
      backgroundColor: cardColor,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: borderColor,
    },

    currencySymbol: {
      fontSize: 22,
      fontWeight: '600',
      color: textColor,
      marginRight: 8,
    },

    amountInput: {
      flex: 1,
      paddingVertical: 16,
      fontSize: 22,
      fontWeight: '600',
      color: textColor,
    },

    // =========================
    // TYPE
    // =========================

    typeContainer: {
      flexDirection: 'row',
      gap: 10,
    },

    typeButton: {
      flex: 1,
      backgroundColor: cardColor,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
    },

    selectedType: {
      backgroundColor: '#1e3a8a',
    },

    typeText: {
      fontSize: 16,
      fontWeight: '600',
      color: textColor,
    },

    selectedTypeText: {
      color: 'white',
    },

    // =========================
    // CATEGORY
    // =========================

    label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
      marginTop: 20,
      color: textColor,
    },

    categoryButton: {
      backgroundColor: cardColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    categoryText: {
      fontSize: 16,
      color: textColor,
    },

    arrow: {
      fontSize: 14,
      color: secondaryTextColor,
    },

    categoryList: {
      backgroundColor: cardColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 12,
      marginTop: 5,
      overflow: 'hidden',
    },

    categoryScroll: {
      maxHeight: 200,
    },

    categoryItem: {
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: lightBorderColor,
    },

    categoryItemText: {
      fontSize: 16,
      color: textColor,
    },

    // =========================
    // SAVE BUTTON
    // =========================

    saveButton: {
      backgroundColor: '#1e3a8a',
      padding: 18,
      borderRadius: 15,
      alignItems: 'center',
      marginTop: 35,
    },

    saveButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },

    deleteText: {
      color: '#ef4444',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },

    editText: {
      color: '#60a5fa',
      fontSize: 20,
      fontWeight: 'bold',
      marginLeft: 10,
    },

    // =========================
    // GRAPH
    // =========================

graphCard: {
  backgroundColor: cardColor,
  borderRadius: 12,
  padding: 15,
  marginTop: 12,
  height: 230,
},

lineChart: {
  alignSelf: 'center',
  borderRadius: 12,
},

    graphLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 25,
      marginTop: 5,
      
    },

    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    incomeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#22c55e',
      marginRight: 6,
    },

    expenseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#ef4444',
      marginRight: 6,
    },

    legendText: {
      fontSize: 13,
      color: secondaryTextColor,
      fontWeight: '500',
    },

    overviewFilters: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 5,
    gap: 8,
  },

  overviewFilter: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: cardColor,
  },

  selectedOverviewFilter: {
    backgroundColor: '#1e3a8a',
  },

  overviewFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: secondaryTextColor,
  },

  selectedOverviewFilterText: {
    color: 'white',
  },

  });
};