total	总资产折合
net_asset	净资产折合
available_cny_display	可用人民币（美元交易市场返回available_usd_display）
available_btc_display	可用比特币
available_ltc_display	可用莱特币（只有人民币交易市场才会返回）
frozen_cny_display	冻结人民币（美元交易市场返回frozen_usd_display）
frozen_btc_display	冻结比特币
frozen_ltc_display	冻结莱特币（只有人民币交易市场才会返回）
loan_cny_display	申请人民币数量（美元交易市场返回loan_usd_display）
loan_btc_display	申请比特币数量
loan_ltc_display	申请莱特币数量（只有人民币交易市场才会返回）



数据格式:(json)：

{
  amount: 63165 //成交量
  level: 86.999 //涨幅
  buys: Array[10] //买10
  p_high: 4410 //最高
  p_last: 4275 &nbsp;//收盘价
  p_low: 4250 //最低
  p_new: 4362 //最新
  p_open: 4275 //开盘
  sells: Array[10] //卖10
  top_buy: Array[5] //买5
  top_sell: Object //卖5 
  total: 273542407.24361 //总量（人民币） 
  trades: Array[15] //实时成交
  symbol:"btccny" //类型
}

{"symbol":"btccny","amount":204283,
"buys":[
{"amount":0.257,"level":1,"price":3878.76},
{"amount":0.005,"level":1,"price":3878.73},
{"amount":5,"level":1,"price":3878.71},
{"amount":0.0075,"level":1,"price":3878.69},
{"amount":0.0359,"level":1,"price":3878.68},
{"amount":0.0094,"level":1,"price":3878.65},
{"amount":0.0359,"level":1,"price":3878.61},
{"amount":0.0476,"level":1,"price":3878.56},
{"amount":0.4232,"level":1,"price":3878.53},
{"amount":0.2413,"level":1,"price":3878.51}],

"amp":0,"level":3879,
"sells":[
{"amount":0.039,"level":1,"price":3878.95},
{"amount":0.2409,"level":1,"price":3878.96},
{"amount":0.1739,"level":1,"price":3878.97},
{"amount":0.5912,"level":1,"price":3879.15},
{"amount":0.57,"level":1,"price":3879.24},
{"amount":0.5203,"level":1,"price":3879.47},
{"amount":0.57,"level":1,"price":3879.49},
{"amount":0.9,"level":1,"price":3879.52},
{"amount":2.0149,"level":1,"price":3879.55},
{"amount":0.54,"level":1,"price":3879.58}
],

"top_sell":[
{"amount":0.039,"level":1,"price":3878.95,"accu":0.039},
{"amount":0.2409,"level":1,"price":3878.96,"accu":0.2799},
{"amount":0.1739,"level":1,"price":3878.97,"accu":0.4538},
{"amount":0.5912,"level":1,"price":3879.15,"accu":1.045},
{"amount":0.57,"level":1,"price":3879.24,"accu":1.615}
]

"p_new":3878.86,
"p_last":3878.99,

"trades":[
{"amount":0.001,"price":3878.86,"time":"02:25:31","en_type":"ask","type":"卖出"},
{"amount":0.001,"price":3878.86,"time":"02:25:30","en_type":"ask","type":"卖出"},
{"amount":0.001,"price":3878.86,"time":"02:25:27","en_type":"ask","type":"卖出"},
{"amount":0.001,"price":3878.79,"time":"02:25:22","en_type":"ask","type":"卖出"},
{"amount":0.002,"price":3878.8,"time":"02:25:18","en_type":"ask","type":"卖出"},
{"amount":0.097,"price":3878.76,"time":"02:25:17","en_type":"ask","type":"卖出"},
{"amount":0.003,"price":3878.77,"time":"02:25:17","en_type":"ask","type":"卖出"},
{"amount":0.04,"price":3878.83,"time":"02:25:15","en_type":"ask","type":"卖出"},
{"amount":0.003,"price":3878.83,"time":"02:25:14","en_type":"ask","type":"卖出"},
{"amount":0.252,"price":3878.83,"time":"02:25:14","en_type":"ask","type":"卖出"},
{"amount":0.074,"price":3878.78,"time":"02:25:14","en_type":"bid","type":"买入"},
{"amount":0.039,"price":3878.88,"time":"02:25:13","en_type":"ask","type":"卖出"},
{"amount":0.019,"price":3878.96,"time":"02:25:11","en_type":"bid","type":"买入"},
{"amount":0.029,"price":3878.95,"time":"02:25:11","en_type":"bid","type":"买入"},
{"amount":0.08,"price":3878.8,"time":"02:25:11","en_type":"bid","type":"买入"},
{"amount":0.02,"price":3878.8,"time":"02:25:11","en_type":"bid","type":"买入"},
{"amount":0.06,"price":3878.87,"time":"02:25:10","en_type":"ask","type":"卖出"},
{"amount":0.05,"price":3878.87,"time":"02:25:10","en_type":"ask","type":"卖出"},
{"amount":0.025,"price":3878.87,"time":"02:25:10","en_type":"ask","type":"卖出"},
{"amount":0.055,"price":3878.87,"time":"02:25:10","en_type":"ask","type":"卖出"},
{"amount":0.08,"price":3878.87,"time":"02:25:10","en_type":"ask","type":"卖出"},
{"amount":0.0101,"price":3878.96,"time":"02:25:10","en_type":"bid","type":"买入"},
{"amount":0.001,"price":3878.89,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.01,"price":3878.96,"time":"02:25:09","en_type":"bid","type":"买入"},
{"amount":0.08,"price":3878.76,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.08,"price":3878.76,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.056,"price":3878.76,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.4967,"price":3878.77,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.1933,"price":3879,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.01,"price":3879,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3879,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3879,"time":"02:25:09","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3879,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.16,"price":3879,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3879,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3879,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.12,"price":3879,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3879,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.148,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.036,"price":3878.97,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.4,"price":3878.94,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.39,"price":3878.94,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.0103,"price":3878.77,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.001,"price":3878.78,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.0147,"price":3878.83,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.004,"price":3878.84,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.112,"price":3878.99,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.023,"price":3878.99,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.125,"price":3878.99,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.01,"price":3878.99,"time":"02:25:08","en_type":"ask","type":"卖出"},
{"amount":0.252,"price":3879.03,"time":"02:25:08","en_type":"bid","type":"买入"},
{"amount":0.0694,"price":3879.18,"time":"02:25:08","en_type":"ask","type":"卖出"}],

"top_buy":[
{"amount":0.257,"level":1,"price":3878.76,"accu":0.257},
{"amount":0.005,"level":1,"price":3878.73,"accu":0.262},
{"amount":5,"level":1,"price":3878.71,"accu":5.262},
{"amount":0.0075,"level":1,"price":3878.69,"accu":5.2695},
{"amount":0.0359,"level":1,"price":3878.68,"accu":5.3054}],

"total":794608439.1032,"p_low":3873.72,"p_open":3875.28,


,"p_high":3886}
