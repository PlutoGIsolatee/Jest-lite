/**
 * Jest Lite
 * 不是对Jest的完全模拟，而是以更轻量的方式实现主要API
 */

const JestLite = Object.create(null);
JestLite.logger = console.log;

function test(name: string, fn) {
    try {
        fn();
        JestLite.logger(`${name} 测试成功`);
    } catch (e) {
        JestLite.logger(`${name} error.tag 测试失败`);
        JestLite.logger(e);
    }
}

const it = test;

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