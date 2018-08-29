function Entry(next, data) {
    this.next = next;
    this.data = data;
}

function List() {
    this.head = new Entry(null,null);
    this.end = new Entry(null,null);
    this.length = 0;

    /** 链表末尾添加元素 */
    this.push = function(data) {
        var newentry=new Entry(null,data);

        if(this.head.data) {
            this.end.next=newentry;
            this.end=newentry; 
        } else { 
            this.head=newentry;
            this.end=newentry;
        }
        this.length++;
    };

    /** 删除第一个元素 */
    this.shift = function() {
        if(this.head.next) {
            this.head = this.head.next;
            this.length--;
        }
        else if(this.head.data) {
            this.head.data = null;
            this.end.data = null;
            this.length--;
        }
    }

    /** 获取第一个元素的值 */
    this.front = function() {
        if(this.head.data) {
            return this.head.data;
        }
    }
}

module.exports.List = List;