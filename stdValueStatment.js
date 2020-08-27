// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
// Loader Header
// @shortname 	=	stdValueStatement @
// @name=	Standard value statement @
// @dataEntity	=   cashMovement @
// @category	=   excelRules @
// @scope=   Root  @

/**
 * @fileOverview
 *
 * <p>&nbsp;Main goals :</p>
 * <ul>
 * <li>Display account balance and cash movement between two dates</li>
 * <li>Status must be filtred in the report</li>
 * </ul>
 * <p>Configuration :<br />&nbsp;</p>
 * <ul>
 * <li>Add information from cash account with an expression context on cash account : stdValueStatementCashAccount</li>
 * <li>Organize cash movement types and analytic types with :
 * <ul>
 * <li>breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeTree</li>
 * <li>stdValueStatementAnalyticTypeTree</li>
 * </ul>
 * </li>
 * <li>custom dictionary with level used in breakdown
 * <ul>
 * <li>stdValueStatementCashMovementTypeLevel1</li>
 * <li>stdValueStatementCashMovementTypeLevel2</li>
 * <li>stdValueStatementCashMovementTypeLevel3</li>
 * <li>stdValueStatementCashMovementTypeLevel4</li>
 * <li>stdValueStatementCashMovementTypeLevel5</li>
 * <li>stdValueStatementAnalyticTypeLevel1</li>
 * <li>stdValueStatementAnalyticTypeLevel2</li>
 * <li>stdValueStatementAnalyticTypeLevel3</li>
 * <li>stdValueStatementAnalyticTypeLevel4</li>
 * <li>stdValueStatementAnalyticTypeLevel5</li>
 * </ul>
 * </li>
 * <li>Balance and movement in column type are translated with following error messages :
 * <ul>
 * <li>stdValueStatementBalance</li>
 * <li>stdValueStatementMovement&nbsp;&nbsp;&nbsp;&nbsp; &nbsp;&nbsp;&nbsp;</li>
 * </ul>
 * </li>
 * </ul>
 * </li>
 * </ul>
 * <p>Migration : </p>
 * <ul>
 * <li>add coloration for pivot</li>
 * </ul>
 * <p>Information :</p>
 * <ul>
 * <li>internal cash account are retrieved only with subsidaries direction</li>
 * </ul>
 *
 * @author Kevin LEMOINE - MCC
 * @version $Id: stdValueStatement.js,v 1.4 2019/09/17 13:32:31 kle Exp $
 */

importClass(java.math.BigDecimal);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.com.mccsoft.diapason.report.PivotReportManager);
importClass(Packages.org.apache.commons.collections.map.MultiKeyMap);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.util.DateUtil);
uselib(reportParametersLibrary);
uselib(birtValuationLibrary);
uselib(excelLibrary);

helper.setAutoflush(false);

var logLevel = "DEBUG";
helper.log(logLevel, "source : " + source);
helper.log(logLevel, "helper.getTransientParams() : " + helper.getTransientParams());
helper.log(logLevel, "helper.getParams() : " + helper.getParams());

helper.stopWatchStart();

// Set static paramters if its are null (pivot hasn't static parameters)
var breakdownCashMovementTypeTree = helper.getParamValue("breakdownCashMovementTypeTree") || "stdValueStatementCashMovementTypeTree";
var breakdownAnalyticTypeTree = helper.getParamValue("breakdownAnalyticTypeTree") || "stdValueStatementAnalyticTypeTree";
var errorMessageMovement = helper.getParamValue("errorMessageMovement") || "stdValueStatementMovement";
var errorMessageBalance = helper.getParamValue("errorMessageBalance") || "stdValueStatementBalance";
var contextName = helper.getParamValue("expressionContext") || "stdValueStatementCashAccount";
var idsHeader = [];
// If this parameter is 'true' ids will be added to the request
if ('true' == helper.getParamValue("idsRequired")) {
	idsHeader.push("APPLICATIVE_STATUS_ID");
	idsHeader.push("CPTY_ID");
	idsHeader.push("CASH_MOVEMENT_TYPE_ID");
	idsHeader.push("ANALYTIC_TYPE_ID");
	idsHeader.push("QUANTITY");
	idsHeader.push("LAST_UPDATE");
	idsHeader.push("ACCOUNT_ID");
}

// Compute analytic type ordering
var analyticLevelMaxIndex = 0;
var analyticTypeOrderMap = new java.util.HashMap();
var analyticTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownAnalyticTypeTree, new java.util.HashMap(), false);
for (var analRowsIterator = analyticTypeBreakDownRows.iterator(); analRowsIterator.hasNext(); ) {
	var analRowsItem = analRowsIterator.next();
	var analyticType = helper.getBreakDownCellValue(analRowsItem, "analyticType");
	var mapForAnalyticType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(analRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementAnalyticTypeLevel" + i);
			if (i > analyticLevelMaxIndex)
				analyticLevelMaxIndex = i;
			mapForAnalyticType.put("AnalyticType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale()))
		} else
			break;
	}
	mapForAnalyticType.put("index", helper.getBreakDownCellValue(analRowsItem, "index"));
	analyticTypeOrderMap.put(analyticType, mapForAnalyticType);
}
helper.log(logLevel, "analyticTypeOrderMap " + analyticTypeOrderMap);

// Compute movement type ordering
var cashMovementTypeLevelMaxIndex = 0;
var cashMovementTypeOrderMap = new java.util.HashMap();
var cashMovementTypeBreakDownRows = helper.selectAllBreakDownRows(breakdownCashMovementTypeTree, new java.util.HashMap(), false);
for (var cashMvtTypeRowsIterator = cashMovementTypeBreakDownRows.iterator(); cashMvtTypeRowsIterator.hasNext(); ) {
	var cashMvtTypeRowsItem = cashMvtTypeRowsIterator.next();
	var cashMovementType = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "cashMovementType");
	var mapForCashMovementType = new java.util.HashMap();
	for (var i = 1; i <= 5; i++) {
		var levelN = helper.getBreakDownCellValue(cashMvtTypeRowsItem, "level" + i);
		if (levelN != null) {
			var customDictionaryValue = helper.getUserDataFromShortname(levelN, "stdValueStatementCashMovementTypeLevel" + i);
			if (i > cashMovementTypeLevelMaxIndex)
				cashMovementTypeLevelMaxIndex = i;
			mapForCashMovementType.put("CashMovementType_level_" + i, customDictionaryValue.getLocalizedName(helper.getCurrentLocale())) // KGN TODO remplacer par la traduction;
		} else
			break;
	}
	mapForCashMovementType.put("index", helper.getBreakDownCellValue(cashMvtTypeRowsItem, "index"));
	cashMovementTypeOrderMap.put(cashMovementType, mapForCashMovementType);
}

helper.log(logLevel, "cashMovementTypeOrderMap " + cashMovementTypeOrderMap);

var dateType = helper.getParamValue("dateType");
var startDate = helper.parseDate(helper.getParamValue("startDate"));
var endDate = helper.parseDate(helper.getParamValue("endDate"));
var frequency = helper.getParamValue("frequency");
if (frequency == null)
	frequency = "1D";
frequency = new java.lang.String(frequency);

var dateHqlColumn = getDateHqlColumn(dateType);
hqlMovement = " from CashMovement cm where cm.amount != 0 ";
hqlMovement += " and " + buildCashAccountFilter("cm.account", "cm.currency");
hqlMovement += " and cm." + dateHqlColumn + " >= :startDate " + " and cm." + dateHqlColumn + " <= :endDate ";
if (StringUtils.isNotBlank(helper.getParamValue("applicativeStatusExtendedListOpt")) == true)
	hqlMovement += " and " + helper.buildListFilter("cm.applicativeStatus.id", helper.getParamValue("applicativeStatusExtendedListOpt"));
else
	hqlMovement += " and cm.applicativeStatus.internalStatus in ('validated', 'forecasted', 'matched') and cm.applicativeStatus.active = true and cm.applicativeStatus.status = 'actual' ";
hqlMovement += " order by cm.applicativeStatus, cm.account, cm.currency, cm. " + dateHqlColumn;

helper.log(logLevel, "hqlMovement " + hqlMovement);

var hqlParams = new java.util.HashMap();
hqlParams.put("startDate", startDate);
hqlParams.put("endDate", endDate);

var params = helper.getParams();

// set default parameter like countervaluation library or quotation type...
params = setDefaultParameters(params);
params.put("locale", helper.getCurrentLocale());

// This header will be used in excel
var en_header = ["Type", "Owner entity", "Owner entity name", "Description", "Bank", "Bank name", "Branch", "Branch name", "Cash account", "Cash account name", "Internal / External", "Currency", "Value date", "Amount", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT", "Countervaluated currency", "Countervaluated amount", "Id", "Applicative status", "Applicative status name", "Analytic type", "Analytic type name", "Analytic type index", "Movement type", "Movement type name", "Movement type index", "Issue date", "Trade date", "Match date", "Search date", "Item reference", "Counterparty", "Is internal counterparty"];

var fr_header = ["Type", "Propriétaire", "Nom du propriétaire", "Description", "Banque", "Nom de la banque", "Agence", "Nom de l'agence", "Compte", "Nom du compte", "Interne / Externe", "Devise", "Date de valeur", "Montant", "Devise de contre-valorisation", "Montant de contre-valorisation", "Id", "Statut applicatif", "Nom du statut applicatif", "Code analytique", "Nom du code analytique", "Index du code analytique", "Code mouvement", "Nom du code mouvement", "Index du code mouvement", "Date d'emission", "Date d'opération", "Date de rapprochement", "Date de recherche", "Numéro de pièce", "Contrepartie", "Contrepartie externe"];

var header = en_header;
if (helper.getCurrentLocale() == "fr_FR") {
	header = fr_header;
}
// Add ids header
header = header.concat(idsHeader);

// This array must have same value than request alias. It will order result
var sqlHeader = ["TYPE", "ENTITY", "ENTITIY_NAME", "COMMENTARY", "BANK", "BANK_NAME", "BRANCH", "BRANCH_NAME", "CASH_ACCOUNT", "CASH_ACCOUNT_NAME", "INTERNAL_EXTERNAL", "CURRENCY", "VALUE_DATE", "AMOUNT", "OVERDRAFT_AMOUNT","LEEWAY_AMOUNT","CV_CURRENCY", "CV_AMOUNT", "ID", "APPLICATIVE_STATUS", "APPLICATIVE_STATUS_NAME", "ANALYTICTYPE", "ANALYTICTYPENAME", "ATINDEX", "MOVEMENTTYPE", "MOVEMENTTYPENAME", "CMTINDEX", "ISSUE_DATE", "TRADE_DATE", "MATCH_DATE", "SEARCH_DATE", "ITEMREFERENCE", "CPTY", "INTRAGROUP"];

sqlHeader = sqlHeader.concat(idsHeader);

var pivotCurrency = getPivotCurrency();

// Cache to call eval (expression context) only one type by cash account
var cacheCashAccount = new java.util.HashMap();

var typeTranslation = new java.util.HashMap();
typeTranslation.put(errorMessageMovement, helper.getErrorMessage(errorMessageMovement));
typeTranslation.put(errorMessageBalance, helper.getErrorMessage(errorMessageBalance));

// Add header in relation to cashMovementType breakdown
for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++) {
	header.push("CashMovementType_level_" + i);
	sqlHeader.push("CashMovementType_level_" + i);

}

// Add header in relation to analyticLevel breakdown
for (var i = 1; i <= analyticLevelMaxIndex; i++) {
	header.push("AnalyticType_level_" + i);
	sqlHeader.push("AnalyticType_level_" + i);
}

// Add header in relation to expression context
var columnheader = getContextColumns(contextName);
if (!columnheader.isEmpty()) {
	header = org.apache.commons.lang.ArrayUtils.addAll(header, columnheader.toArray());
	sqlHeader = org.apache.commons.lang.ArrayUtils.addAll(sqlHeader, columnheader.toArray());
}

// Map used to help to use row
var sqlHeaderMap = headerMap(sqlHeader);
// Map used to help to use row
var columnHeaderMap = headerMap(header);

var headerSize = sqlHeader.length;

var refCursor = new com.mccsoft.diapason.util.RefCursorResult();
refCursor.header = header;

// Create an excel sheet (if you want an other sheet, you )
var range = new ExcelRangeResult(helper.getParams());
range.result = refCursor;

if (source instanceof PivotReportManager) {
	initializedPivotReport();
}

var quotationType = helper.load(Packages.com.mccsoft.diapason.data.userData.CustomDictionaryValue, new java.lang.Long(params.get("quotationType")));
var valuationCurrency = helper.load(Packages.com.mccsoft.diapason.data.Currency, new java.lang.Long(params.get("valuationCurrency")));
var shouldGenerateEmptyRow = true;
var cashAccount = null;
var currency = null;
var balances = null;
var valueDate = null;
var dimensionInitialized = false;

var applicativeStatusForBalanceCalculationList = getApplicativeStatusForBalanceCalculation();
var balanceValueFromMapComputed = null;
/* variable used to compare previous row and current one to manage the different changes */
var lastStatus = null;
var lastBalanceValueIndex = null;
var lastAccount = null;
var lastCurrency = null;
var lastPivotDate = startDate;

var cashMovementItem = null;
var applicativeStatus = null;
var account = null;
var currency = null;
var pivotDate = null;
var balanceValueMap = null;
var currentBalance = java.math.BigDecimal.ZERO;
var loopStartDate = startDate;
var separator = "#__#";
try {
	helper.createScrollableQuery(hqlMovement, hqlParams, false, true);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		range.result.cursor.clear();
		for (var iterator = entries.iterator(); iterator.hasNext(); ) {
			var row = iterator.next();
			cashMovementItem = row[0];
			if (helper.getParamValue("intraGroup") == "false" && cashMovementItem.getCpty() != null && cashMovementItem.getCpty().getIsTrade() == true)
				continue;
			applicativeStatus = cashMovementItem.getApplicativeStatus();
			account = cashMovementItem.getAccount();
			currency = cashMovementItem.getCurrency();
			pivotDate = cashMovementItem.getValueDate();
			if (dateType == "T")
				pivotDate = cashMovementItem.getTradeDate();
			if (dateType == "I")
				pivotDate = cashMovementItem.getIssueDate();
			if (lastStatus == null || (lastStatus != null && lastStatus.getShortname() != applicativeStatus.getShortname())) {
				if (lastStatus != null) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					/* Parcours des soldes de comptes non impactés pour l'ancien status, on remplis une ligne pour chaque date pour chaque compte et devise*/
					if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
						for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
							var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
							completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
						}
						applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
					}
				}
				lastStatus = applicativeStatus;
				loopStartDate = startDate;
				if (applicativeStatusForBalanceCalculationList.contains(applicativeStatus.getShortname()) == true)
					loopStartDate = helper.addDays(startDate, -1);
				balanceValueMap = getBalanceValueMap(getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus));
				currentBalance = java.math.BigDecimal.ZERO;
				balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
				if (balanceValueFromMapComputed != null)
					currentBalance = balanceValueFromMapComputed.getBalance();
				lastAccount = account;
				lastCurrency = currency;
				lastPivotDate = loopStartDate;
			} else { // lastStatus = applicativeStatus
				if (lastAccount.getShortname() != account.getShortname() || lastCurrency.getShortname() != currency.getShortname()) {
					// For last account/currency complete balance for date not already managed (without movements for those date)
					completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
					if (balanceValueFromMapComputed != null)
						balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
					currentBalance = java.math.BigDecimal.ZERO;
					balanceValueFromMapComputed = balanceValueMap.get(account.getShortname() + separator + currency.getShortname());
					if (balanceValueFromMapComputed != null)
						currentBalance = balanceValueFromMapComputed.getBalance();
					lastAccount = account;
					lastCurrency = currency;
					lastPivotDate = loopStartDate;
				}
			}
			if (pivotDate.compareTo(lastPivotDate) > 0) {
				completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), pivotDate);
				lastPivotDate = pivotDate;
			}
			currentBalance = currentBalance.add(cashMovementItem.getAmount().multiply(helper.bigDecimal(cashMovementItem.getSign())));
			completeMovementExcelRow(range, cashMovementItem, lastPivotDate);
		}

		if (source instanceof PivotReportManager) {
			for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
				var pivotRow = itPivot.next();
				addPivotRow(sqlHeader, pivotRow);
			}
		} else {
			helper.fillInSheetFromCursor(range);
		}
	}
} catch (e) {}
finally {
	helper.closeScrollableQuery();
}
/* End Loop managing with potentially missing opening balance for last account and currency managed, account balance not managed for lastStatus or pending status in applicativeStatusForBalanceCalculationList */
range.result.cursor.clear();

if (lastStatus != null) {
	if (lastAccount != null && lastCurrency != null) {
		completeCashAccountExcelRow(range, lastAccount, lastCurrency, lastStatus, currentBalance, helper.addDays(lastPivotDate, 1), endDate);
		if (balanceValueFromMapComputed != null)
			balanceValueMap.remove(lastAccount.getShortname() + separator + lastCurrency.getShortname());
	}
	if (applicativeStatusForBalanceCalculationList.contains(lastStatus.getShortname())) {
		for (var balanceValueIterator = balanceValueMap.keySet().iterator(); balanceValueIterator.hasNext(); ) {
			var balanceValueItem = balanceValueMap.get(balanceValueIterator.next());
			completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
		}
		applicativeStatusForBalanceCalculationList.remove(lastStatus.getShortname());
	}
}

for (var statusIterator = applicativeStatusForBalanceCalculationList.iterator(); statusIterator.hasNext(); ) {
	var statusShortname = statusIterator.next();
	lastStatus = helper.getStatusFromShortname(statusShortname, "cashMovement");
	var accountBalanceList = getCashAccountBalances(dateType, helper.addDays(startDate, -1), lastStatus);
	for (var balanceValueIterator = accountBalanceList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		completeCashAccountExcelRow(range, balanceValueItem.getAccount(), balanceValueItem.getCurrency(), lastStatus, balanceValueItem.getBalance(), startDate, endDate);
	}
}

if (shouldGenerateEmptyRow == true)
	range.initEmptyRange();

if (source instanceof PivotReportManager) {
	for (var itPivot = range.result.cursor.iterator(); itPivot.hasNext(); ) {
		var pivotRow = itPivot.next();
		addPivotRow(sqlHeader, pivotRow);
	}
} else {
	helper.fillInSheetFromCursor(range);
}

helper.stopWatchStop(true);

/**
 * Function to retrieve sql colum by type (currently report is only by value_date)
 */
function getDateColumn(dateType) {
	var date_column_name = "value_date";
	if (dateType == 'T') {
		date_column_name = "trade_date";
	} else if (dateType == 'I') {
		date_column_name = "issue_date";
	}
	return date_column_name;
}

/**
 * Function to retrieve hql colum by type (currently report is only by value_date)
 */
function getDateHqlColumn(dateType) {
	var date_column_name = "valueDate";
	if (dateType == 'T') {
		date_column_name = "tradeDate";
	} else if (dateType == 'I') {
		date_column_name = "issueDate";
	}
	return date_column_name;
}

/**
 * Retrieve all expressions in expression context
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	return helper.executeHqlQuery(hql, par, -1);
}

// Pivot report function
function initializedPivotReport() {
	source.setTitle(helper.getErrorMessage("stdValueStatement"));
	source.setPrecision(2);
	source.hideGrandTotals();
	source.hideTotals();
}

function initializeDimension(codeHeader, header, row) {
	for (var i = 0; i < codeHeader.length; i++) {
		if (codeHeader[i].toUpperCase().indexOf("AMOUNT") != -1) {
			source.addMeasure(codeHeader[i], header[i], PivotReportManager.typeSpecial);
			continue;
		}
		if (codeHeader[i] == "ID") {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			continue;
		}
		if (row[i] != null) {
			if (row[i].getClass().getName() == "java.math.BigDecimal") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeNumeric);
			} else if (row[i].getClass().getName() == "java.sql.Timestamp") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeDate);

			} else if (row[i].getClass().getName() == "java.lang.String") {
				source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
			}
		} else {
			source.addDimension(codeHeader[i], header[i], PivotReportManager.typeString);
		}
	}
	source.setDefaultColumns("VALUE_DATE");
	source.setDefaultFilters("APPLICATIVE_STATUS");
	source.setDefaultMeasures("CV_AMOUNT");
	source.setDefaultRows("CV_CURRENCY,BANK,CASH_ACCOUNT,TYPE,APPLICATIVE_STATUS");
}

function addPivotRow(codeHeader, row) {
	var specials = new java.util.HashMap();
	for (var i = 0; i < codeHeader.length; i++) {
		specials.put(codeHeader[i], row[i]);
	}
	source.addItem(specials);
}

/**
 * build filter for hql request according to filter on currency and account
 * @param {*} cashAccountObj
 * @param {*} currencyObj
 */
function buildCashAccountFilter(cashAccountObj, currencyObj) {
	filter = " (" + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj, "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or ( " + cashAccountObj + ".isInternal = true and " + helper.createFilter(helper.getParamValue("scope"), DiapasonFilter.CHILDREN, cashAccountObj + ".bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + "))";
	if (helper.getParamValue("internalAccounts") == "true") {
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	} else {
		filter += " and " + cashAccountObj + ".isInternal = false ";
		if (helper.getParamValue("bankAccounts") == "false")
			filter += " and " + cashAccountObj + ".isInternal = true ";
	}
	if (helper.getParamValue("onlyActiveParameter") == "true")
		filter += " and " + cashAccountObj + ".active = true ";

	filter += " and " + helper.buildListFilter(cashAccountObj + ".ownerEntity.id", helper.getParamValue("entity"));
	filter += " and " + helper.buildListFilter(currencyObj + ".id", helper.getParamValue("currency"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("bank"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".bankEntity.id", helper.getParamValue("branch"));
	filter += " and " + helper.buildListFilter(cashAccountObj + ".id", helper.getParamValue("account"));

	return filter;
}

function getCashAccountBalances(dateType, date, status) {
	var statusList = new java.util.ArrayList();
	statusList.add(status);

	var balancesList = helper.getCashAccountBalances(buildCashAccountFilter("a", "c"), dateType, statusList, date);
	return balancesList;
}

/**
 * For balance computation, we assume to always use internal status : 'forecasted','validated','matched'
 */
function getApplicativeStatusForBalanceCalculation() {
	var hqlStatus = "Select aps.shortname from ApplicativeStatus aps where aps.status = 'actual' and aps.active = true and aps.category = 'cashMovement' and aps.internalStatus in ('forecasted','validated','matched') ";
	return helper.executeHqlQuery(hqlStatus, null, -1);
}

/**
 * fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashAccount
 * @param {*} currency
 * @param {*} status
 * @param {*} balanceAmount
 * @param {*} periodStartDate
 * @param {*} periodEndDate
 */
function completeCashAccountExcelRow(range, cashAccount, currency, status, balanceAmount, periodStartDate, periodEndDate) {
	if (balanceAmount == java.math.BigDecimal.ZERO) // Do not display zero balance amount.
		return;
	var statusToDisplay = status; // TODO to be change by getting a custom dictionary value by user data
	for (var tempDate = periodStartDate; tempDate.compareTo(periodEndDate) <= 0; tempDate = helper.addDays(tempDate, 1)) {
		if (shouldDisplayDate(tempDate) == false)
			continue;
		
		var brkParams = new java.util.HashMap();
		brkParams.put("cashAccount", cashAccount.getId());
		brkParams.put("currency", currency.getId());
		var brkRow = helper.selectBestBreakDownRow("cashAccountOverdraft",brkParams);
		var overdraftAmount = java.math.BigDecimal.ZERO ;

		if (brkRow != null)
		 
		    var overdraftAmount = helper.bigDecimal(helper.getBreakDownCellValue(brkRow,"overdraftAmount"));
	
	
		var valueArray = ExcelRangeResult.createArray(headerSize);
		
		

		valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageBalance);
		valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
		valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
		valueArray[sqlHeaderMap.get("COMMENTARY")] = "";
		valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
		valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
		valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
		valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
		valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
		valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
		valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
		valueArray[sqlHeaderMap.get("VALUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("AMOUNT")] = balanceAmount;
		valueArray[sqlHeaderMap.get("OVERDRAFT_AMOUNT")] = overdraftAmount ;
		valueArray[sqlHeaderMap.get("LEEWAY_AMOUNT")] = balanceAmount.add(helper.bigDecimal(overdraftAmount));
		valueArray[sqlHeaderMap.get("ID")] = 0;
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
		valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = "";
		valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("ATINDEX")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = "";
		valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = "";
		valueArray[sqlHeaderMap.get("CMTINDEX")] = "";
		valueArray[sqlHeaderMap.get("ISSUE_DATE")] = "";
		valueArray[sqlHeaderMap.get("TRADE_DATE")] = "";
		valueArray[sqlHeaderMap.get("MATCH_DATE")] = "";
		valueArray[sqlHeaderMap.get("SEARCH_DATE")] = tempDate;
		valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = "";
		valueArray[sqlHeaderMap.get("CPTY")] = "";
		valueArray[sqlHeaderMap.get("INTRAGROUP")] = "";

		if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
			var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
		} else {
			valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
			valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
		}
		if (helper.getParamValue("idsRequired") == "true") {
			valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = null;
			valueArray[sqlHeaderMap.get("CPTY_ID")] = null;
			valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = null;
			valueArray[sqlHeaderMap.get("QUANTITY")] = null;
			valueArray[sqlHeaderMap.get("LAST_UPDATE")] = null;
			valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
		}
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
		// expression context on cash account : used to retrieved client information
		if (!columnheader.isEmpty()) {
			var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
			var cashAccountList = cacheCashAccount.get(cashAccountShortname);
			var cashAccount = null;
			var cashAccountEval = null;
			if (cashAccountList != null) {
				cashAccount = cashAccountList.get(0);
				cashAccountEval = cashAccountList.get(1);
			} else {
				cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
				cashAccountEval = helper.eval(contextName, cashAccount);
				var cashList = new java.util.ArrayList();
				cashList.add(cashAccount);
				cashList.add(cashAccountEval);
				cacheCashAccount.put(cashAccountShortname, cashList);
			}

			// Add all expression context in result column
			for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
				var column = it.next();
				var value = cashAccountEval.get(column);
				if (value == null)
					value = "";
				valueArray[sqlHeaderMap.get(column)] = value;
			}
		}
		range.result.cursor.add(valueArray);
		shouldGenerateEmptyRow = false;
	}

}

/**
 * Fill a range for a period for the same balance of account
 * @param {*} range
 * @param {*} cashMovement
 * @param {*} pivotDate
 */
function completeMovementExcelRow(range, cashMovement, pivotDate) {
	var statusToDisplay = cashMovement.getApplicativeStatus(); // TODO to be change by getting user data cdv
	var analyticType = cashMovement.getAnalyticType();
	var analyticTypeOrderMapItem = (analyticType != null) ? analyticTypeOrderMap.get(analyticType.getShortname()) : null;
	var cashMovementType = cashMovement.getCashMovementType();
	var cashMovementTypeOrderMapItem = cashMovementTypeOrderMap.get(cashMovementType.getShortname());
	var cashAccount = cashMovement.getAccount();
	var currency = cashMovement.getCurrency();
	var cpty = cashMovement.getCpty();
	var valueArray = ExcelRangeResult.createArray(headerSize);
	valueArray[sqlHeaderMap.get("TYPE")] = typeTranslation.get(errorMessageMovement);
	valueArray[sqlHeaderMap.get("ENTITY")] = cashAccount.getOwnerEntity().getShortname();
	valueArray[sqlHeaderMap.get("ENTITIY_NAME")] = cashAccount.getOwnerEntity().getName();
	valueArray[sqlHeaderMap.get("COMMENTARY")] = cashMovement.getDescription();
	valueArray[sqlHeaderMap.get("BANK")] = cashAccount.getBankEntity().getShortname();
	valueArray[sqlHeaderMap.get("BANK_NAME")] = cashAccount.getBankEntity().getName();
	valueArray[sqlHeaderMap.get("BRANCH")] = cashAccount.getBranchEntity().getShortname();
	valueArray[sqlHeaderMap.get("BRANCH_NAME")] = cashAccount.getBranchEntity().getName();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT")] = cashAccount.getShortname();
	valueArray[sqlHeaderMap.get("CASH_ACCOUNT_NAME")] = cashAccount.getName();
	valueArray[sqlHeaderMap.get("INTERNAL_EXTERNAL")] = (cashAccount.getIsInternal() == true) ? "Internal" : "External";
	valueArray[sqlHeaderMap.get("CURRENCY")] = currency.getShortname();
	valueArray[sqlHeaderMap.get("VALUE_DATE")] = cashMovement.getValueDate();
	valueArray[sqlHeaderMap.get("AMOUNT")] = cashMovement.getAmount().multiply(helper.bigDecimal(cashMovement.getSign()));
	valueArray[sqlHeaderMap.get("ID")] = cashMovement.getId();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS")] = statusToDisplay.getShortname();
	valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_NAME")] = statusToDisplay.getLocalizedName(helper.getCurrentLocale());
	valueArray[sqlHeaderMap.get("ANALYTICTYPE")] = (analyticType != null) ? analyticType.getShortname() : null;
	valueArray[sqlHeaderMap.get("ANALYTICTYPENAME")] = (analyticType != null) ? analyticType.getLocalizedName(helper.getCurrentLocale()) : null; // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("ATINDEX")] = (analyticTypeOrderMapItem != null && analyticTypeOrderMapItem.get("index") != null) ? analyticTypeOrderMapItem.get("index") : "";
	valueArray[sqlHeaderMap.get("MOVEMENTTYPE")] = cashMovementType.getShortname();
	valueArray[sqlHeaderMap.get("MOVEMENTTYPENAME")] = cashMovementType.getLocalizedName(helper.getCurrentLocale()); // TODO Ajouter la traduction
	valueArray[sqlHeaderMap.get("CMTINDEX")] = (cashMovementTypeOrderMapItem != null && cashMovementTypeOrderMapItem.get("index") != null) ? cashMovementTypeOrderMapItem.get("index") : ""; ;
	valueArray[sqlHeaderMap.get("ISSUE_DATE")] = cashMovement.getIssueDate();
	valueArray[sqlHeaderMap.get("TRADE_DATE")] = cashMovement.getTradeDate();
	valueArray[sqlHeaderMap.get("MATCH_DATE")] = cashMovement.getMatchDate();
	valueArray[sqlHeaderMap.get("SEARCH_DATE")] = getSearchDate(pivotDate);
	valueArray[sqlHeaderMap.get("ITEMREFERENCE")] = cashMovement.getItemReference();
	valueArray[sqlHeaderMap.get("CPTY")] = (cpty != null) ? cpty.getShortname() : null;
	valueArray[sqlHeaderMap.get("INTRAGROUP")] = (cpty != null && cpty.getIsTrade() == true) ? "Intra group" : "External";
	if (valueArray[sqlHeaderMap.get("AMOUNT")] != null && params.get("countervaluation") != "false") {
		var currency = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CURRENCY")], "com.mccsoft.diapason.data.Currency", false);
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = countervaluation(valueArray[sqlHeaderMap.get("AMOUNT")], currency, valuationCurrency, pivotCurrency, quotationType, getBirtDateFormat().parse(params.get("quotationDate")), false).get("countervalue");
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valuationCurrency.getShortname();
	} else {
		valueArray[sqlHeaderMap.get("CV_AMOUNT")] = valueArray[sqlHeaderMap.get("AMOUNT")];
		valueArray[sqlHeaderMap.get("CV_CURRENCY")] = valueArray[sqlHeaderMap.get("CURRENCY")];
	}
	if (helper.getParamValue("idsRequired") == "true") {
		valueArray[sqlHeaderMap.get("APPLICATIVE_STATUS_ID")] = cashMovement.getApplicativeStatus().getId();
		valueArray[sqlHeaderMap.get("CPTY_ID")] = (cpty != null) ? cpty.getId() : null;
		valueArray[sqlHeaderMap.get("CASH_MOVEMENT_TYPE_ID")] = cashMovementType.getId();
		valueArray[sqlHeaderMap.get("ANALYTIC_TYPE_ID")] = (analyticType != null) ? analyticType.getId() : null;
		valueArray[sqlHeaderMap.get("QUANTITY")] = cashMovement.getQuantity();
		valueArray[sqlHeaderMap.get("LAST_UPDATE")] = cashMovement.getLastUpdate();
		valueArray[sqlHeaderMap.get("ACCOUNT_ID")] = cashAccount.getId();
	}
	if (cashMovementTypeOrderMapItem != null)
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = cashMovementTypeOrderMapItem.get("CashMovementType_level_" + i);
	else
		for (var i = 1; i <= cashMovementTypeLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("CashMovementType_level_" + i)] = "";
	if (analyticTypeOrderMapItem != null)
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = analyticTypeOrderMapItem.get("AnalyticType_level_" + i);
	else
		for (var i = 1; i <= analyticLevelMaxIndex; i++)
			valueArray[sqlHeaderMap.get("AnalyticType_level_" + i)] = "";
	// expression context on cash account : used to retrieved client information
	if (!columnheader.isEmpty()) {
		var cashAccountShortname = valueArray[sqlHeaderMap.get("CASH_ACCOUNT")];
		var cashAccountList = cacheCashAccount.get(cashAccountShortname);
		var cashAccount = null;
		var cashAccountEval = null;
		if (cashAccountList != null) {
			cashAccount = cashAccountList.get(0);
			cashAccountEval = cashAccountList.get(1);
		} else {
			cashAccount = helper.getItemFromShortname(valueArray[sqlHeaderMap.get("CASH_ACCOUNT")], "com.mccsoft.diapason.data.CashAccount", false); ;
			cashAccountEval = helper.eval(contextName, cashAccount);
			var cashList = new java.util.ArrayList();
			cashList.add(cashAccount);
			cashList.add(cashAccountEval);
			cacheCashAccount.put(cashAccountShortname, cashList);
		}

		// Add all expression context in result column
		for (var it = cashAccountEval.keySet().iterator(); it.hasNext(); ) {
			var column = it.next();
			var value = cashAccountEval.get(column);
			if (value == null)
				value = "";
			valueArray[sqlHeaderMap.get(column)] = value;
		}
	}
	range.result.cursor.add(valueArray);
	shouldGenerateEmptyRow = false;
	if (source instanceof PivotReportManager && !dimensionInitialized) {
		initializeDimension(sqlHeader, header, entry);
		dimensionInitialized = true;
	}

}

function getBalanceValueMap(balanceValueList) {
	var balanceValueMap = new java.util.HashMap();
	var separator = "#__#";
	for (var balanceValueIterator = balanceValueList.iterator(); balanceValueIterator.hasNext(); ) {
		var balanceValueItem = balanceValueIterator.next();
		balanceValueMap.put(balanceValueItem.getAccount().getShortname() + separator + balanceValueItem.getCurrency().getShortname(), balanceValueItem);
	}
	return balanceValueMap;
}

/* Balance should be getted only on period date */
function shouldDisplayDate(balanceDate) {
	if (frequency == "IF" || frequency == "1D")
		return true;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(balanceDate) < 0) {
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(balanceDate) == 0)
			return true;
		else
			return false;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var daysBetween = helper.daysBetween(startDate, balanceDate);
	return (daysBetween % quantity) == 0;
}

/* Search date is computed according frequency and startDate */
function getSearchDate(movementDate) {
	var returnDate = startDate;
	if (frequency == "IF" || frequency == "1D")
		return movementDate;
	var quantity = parseInt(frequency.substring(0, frequency.length() - 1));
	if (frequency.indexOf("M") >= 0) {
		var tempDate = startDate;
		while (tempDate.compareTo(movementDate) < 0) {
			returnDate = tempDate;
			tempDate = DateUtil.addMonths(tempDate, quantity);
		}
		if (tempDate.compareTo(movementDate) == 0)
			return tempDate;
		else
			return returnDate;
	}
	if ((frequency.indexOf("W") >= 0))
		quantity = quantity * 7;
	var tempDate = startDate;
	while (tempDate.compareTo(movementDate) < 0) {
		returnDate = tempDate;
		tempDate = DateUtil.addDays(tempDate, quantity);
	}
	if (tempDate.compareTo(movementDate) == 0)
		return tempDate;
	else
		return returnDate;
}
