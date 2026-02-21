/**
 * Jest Lite
 * 不是对Jest的完全模拟，而是以更轻量的方式实现主要API
 */



type Tester = (
    this: TesterContext,
    a: any,
    b: any,
    customTesters: Array<Tester>,
) => boolean | undefined;

type EqualsFunction = (
    a: unknown,
    b: unknown,
    customTesters?: Array<Tester>,
    strictCheck?: boolean,
) => boolean;

interface TesterContext {
    equals: EqualsFunction;
}

const equals: EqualsFunction = (a, b, customTesters = [], strictCheck = false) => {
    return equals(a, b, [], [], customTesters, strictCheck);
}

function eq(
    a: any,
    b: any,
    aStack: Array<unknown>,
    bStack: Array<unknown>,
    customTesters: Array<Tester>,
    strictCheck: boolean | undefined,
): boolean {

    let result = true;

    const asymmetricResult = asymmetricMatch(a, b);
    if (asymmetricResult !== undefined) {
        return asymmetricResult;
    }

    const testerContext: TesterContext = { equals };

    for (const item of customTesters) {
        const customTestersResult = item.call(testerContext, a, b, customTesters);
        if (customTestersResult !== undefined) {
            return customTestersResult;
        }
    }

    if (a instanceof Error && b instanceof Error) {
        return a.message === b.message;
    }

    if (Object.is(a, b)) {
        return true;
    }
    //现在a，b相等的机会仅剩对象结构相同、包装类型值相等、特殊内置类型相等

    if (a === null || b === null) {
        return false;
    }

    const aClassName = Object.prototype.toString.call(a);
    if (aClassName !== Object.prototype.toString.call(b)) {
        return false;
    }
    //现在a，b的类型表示标签相同
    //a\b p  P   o
    //p   F  F   \
    //P   F  ?   \
    //o   F  F   ?

    switch (aClassName) {
        case '[objest Boolean]':
        case '[object String]':
        case '[object Number]':
            //p for primitive
            //a\b p  P
            //p   F  F
            //P   F  ?
            if (typeof a !== typeof b) {
                //原始值和对应对象包装类型标签相同
                //如果typeof不同，则不相等
                return false;
                //a\b p  P
                //p   F  \
                //P   \  ?
            } else if (typeof a !== 'object' && typeof b !== 'object') {
                return false;
                //a\b p  P
                //p   \  \
                //P   \  ?
            } else {
                return Object.is(a.valueOf(), b.valueOf());
            }
        case '[object Date]':
            return a.getTime() === b.getTime();
        case '[object RegExp]':
            //RegExp.prototype.flags按字母顺序排列
            return a.source === b.source && a.flags === b.flags;
        case '[object URL]':
            return a.href === b.href;
    }

    //a\b p  P   o
    //o   F  F   ?
    if (typeof a !== 'object' || typeof b !== 'object') {
        return false;
        //a\b  P   o
        //o    F   ?
    }

    if (isDomNode(a) && isDomNode(b)) {
        return a.isEqualNode(b);
    }

    //开始结构递归遍历判断
    let length = aStack.length;
    while (length--) {
        if (aStack[length] === a) {
            return bStack[length] === b;
        } else if (bStack[length] === b) {
            return false;
        }
    }
    aStack.push(a);
    bStack.push(b);

    if (strictCheck && className === '[object Array]' && a.length !== b.length) {
        return false;
    }

    const aKeys = keys(a, hasOwnKey);
    let key;

    const bKeys = keys(b, hasOwnKey);

    if (!strictCheck) { 
        for (let index = 0; index !== bKeys.length; ++index) {
            key = bKeys[index];
            if((isAsymmetric(a[key]) || b[key] === undefined) && !hasOwnKey(b, key)){
                aKeys.push(key);
            }
        }
        for (let index = 0; index !== aKeys.length; ++index) {
            key = aKeys[index];
            if((isAsymmetric(b[key]) || a[key] === undefined) && !hasOwnKey(a, key)){
                bKeys.push(key);
            }
        }
    }

    let size = aKeys.length;
    if(bKeys.length !== size){
        return false;
    }

    while (size--) {
        key = aKeys[size];

        if(strictCheck){
            result =hasOwnKey(b, key) && 
            eq(a[key], b[key], aStack, bStack, customTesters, strictCheck);
        } else {
            result = (hasOwnKey(b, key) ||
            isAsymmetric(a[key]) || a[key] === undefined) &&
            eq(a[key], b[key], aStack, bStack, customTesters, strictCheck);
        }

        if (!result) {
            return false;
        }
    }

    aStack.pop();
    bStack.pop();

    return result;
}



function isAsymmetric(obj: any) {
    return Boolean(obj) && isA('Function', obj.asymmetricMatch);
}

function asymmetricMatch(a: any, b: any) {
    const asymmetricA = isAsymmetric(a);
    const asymmetricB = isAsymmetric(b);

    if (asymmetricA && asymmetricB) {
        return undefined;
    } else if (asymmetricA) {
        return a.asymmetricMatch(b);
    } else if (asymmetricB) {
        return b.asymmetricMatch(a);
    }
}


function keys(obj: object, filterKey: (obj: object, key: string) => boolean) {
    const keys = [];
    for (const key in obj) {
        if (filterKey(obj, key)) {
            keys.push(key);
        }
    }
    return [
        ...keys,
        ...Object.getOwnPropertySymbols(obj).filter(
            symbol => Object.getOwnPropertyDescriptor(obj, symbol)!.enumerable,
        ),
    ];
}

function hasOwnKey(obj: any, key: string | symbol) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function isA<T>(typeName: string, value: unknown): value is T {
    return Object.prototype.toString.call(value) === `[object ${typeName}]`;
}

function isDomNode(obj: any): boolean {
    return (
        obj !== null &&
        typeof obj === 'object' &&
        typeof obj.nodeType === 'number' &&
        typeof obj.nodeName === 'string' &&
        typeof obj.isEqualNode === 'function'
    );
}